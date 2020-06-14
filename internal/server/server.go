package server

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/gofrs/uuid"
	"github.com/speps/go-hashids"
	"github.com/zikaeroh/codies/internal/game"
	"github.com/zikaeroh/codies/internal/protocol"
	"github.com/zikaeroh/ctxjoin"
	"go.uber.org/atomic"
	"golang.org/x/sync/errgroup"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

const maxRooms = 1000

var (
	ErrRoomExists   = errors.New("server: rooms exist")
	ErrTooManyRooms = errors.New("server: too many rooms")
)

type Server struct {
	clientCount atomic.Int64
	roomCount   atomic.Int64
	doPrune     chan struct{}
	ready       chan struct{}

	mu sync.Mutex

	ctx     context.Context
	rooms   map[string]*Room
	roomIDs map[string]*Room

	hid    *hashids.HashID
	nextID int64
}

func NewServer() *Server {
	hd := hashids.NewData()
	hd.MinLength = 8
	hd.Salt = uuid.Must(uuid.NewV4()).String() // IDs are only valid for this server instance; ok to randomize salt.
	hid, err := hashids.NewWithData(hd)
	if err != nil {
		panic(err)
	}

	return &Server{
		ready:   make(chan struct{}),
		doPrune: make(chan struct{}, 1),
		rooms:   make(map[string]*Room),
		roomIDs: make(map[string]*Room),
		hid:     hid,
	}
}

func (s *Server) Run(ctx context.Context) error {
	s.ctx = ctx

	close(s.ready)
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-s.doPrune:
			s.prune()

		case <-ticker.C:
			s.prune()
		}
	}
}

func (s *Server) FindRoom(name string) *Room {
	<-s.ready

	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rooms[name]
}

func (s *Server) FindRoomByID(id string) *Room {
	<-s.ready

	s.mu.Lock()
	defer s.mu.Unlock()
	return s.roomIDs[id]
}

func (s *Server) CreateRoom(name, password string) (*Room, error) {
	<-s.ready

	s.mu.Lock()
	defer s.mu.Unlock()

	room := s.rooms[name]
	if room != nil {
		return nil, ErrRoomExists
	}

	if len(s.rooms) >= maxRooms {
		return nil, ErrTooManyRooms
	}

	id, err := s.hid.EncodeInt64([]int64{s.nextID})
	if err != nil {
		return nil, err
	}
	s.nextID++

	ctx, cancel := context.WithCancel(s.ctx)

	room = &Room{
		Name:        name,
		Password:    password,
		ID:          id,
		clientCount: &s.clientCount,
		roomCount:   &s.roomCount,
		ctx:         ctx,
		cancel:      cancel,
		room:        game.NewRoom(nil),
		players:     make(map[game.PlayerID]noteSender),
		turnSeconds: 60,
	}

	room.lastSeen.Store(time.Now())

	room.room.NewGame()

	s.rooms[name] = room
	s.roomIDs[room.ID] = room
	s.roomCount.Inc()
	metricRooms.Inc()

	log.Printf("created new room '%s' (%s)", name, room.ID)

	if s.nextID%100 == 0 {
		s.triggerPrune()
	}

	return room, nil
}

func (s *Server) triggerPrune() {
	select {
	case s.doPrune <- struct{}{}:
	default:
	}
}

func (s *Server) prune() {
	s.mu.Lock()
	defer s.mu.Unlock()

	toRemove := make([]string, 0, 1)

	for name, room := range s.rooms {
		lastSeen := room.lastSeen.Load().(time.Time)
		if time.Since(lastSeen) > 10*time.Minute {
			toRemove = append(toRemove, name)
		}
	}

	if len(toRemove) == 0 {
		return
	}

	for _, name := range toRemove {
		room := s.rooms[name]
		room.mu.Lock()
		room.stopTimer()
		room.mu.Unlock()

		room.cancel()
		delete(s.rooms, name)
		delete(s.roomIDs, room.ID)
		s.roomCount.Dec()
		metricRooms.Dec()
	}

	log.Printf("pruned %d rooms", len(toRemove))
}

func (s *Server) Stats() (rooms, clients int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.rooms), int(s.clientCount.Load())
}

type Room struct {
	Name     string
	Password string
	ID       string

	ctx         context.Context
	cancel      context.CancelFunc
	clientCount *atomic.Int64
	roomCount   *atomic.Int64

	mu       sync.Mutex
	room     *game.Room
	players  map[game.PlayerID]noteSender
	state    *stateCache
	lastSeen atomic.Value

	timed        bool
	turnSeconds  int
	turnDeadline *time.Time
	turnTimer    *time.Timer

	hideBomb bool
}

type noteSender func(protocol.ServerNote)

func (r *Room) HandleConn(ctx context.Context, playerID uuid.UUID, nickname string, c *websocket.Conn) {
	ctx, cancel := ctxjoin.AddCancel(ctx, r.ctx)
	defer cancel()

	metricClients.Inc()
	defer metricClients.Dec()

	clientCount := r.clientCount.Inc()
	log.Printf("client connected to room '%s' (%s); %v clients currently connected to %v rooms", r.Name, r.ID, clientCount, r.roomCount.Load())

	defer func() {
		clientCount := r.clientCount.Dec()
		log.Printf("client disconnected from room '%s' (%s); %v clients currently connected to %v rooms", r.Name, r.ID, clientCount, r.roomCount.Load())
	}()

	defer c.Close(websocket.StatusGoingAway, "going away")
	g, ctx := errgroup.WithContext(ctx)

	r.mu.Lock()
	r.players[playerID] = func(s protocol.ServerNote) {
		if ctx.Err() != nil {
			return
		}

		// It's not safe to start more group goroutines concurrently; just use a regular
		// goroutine and hope that errors here will be reflected later via ping/receive failures.
		go func() {
			ctx, cancel := context.WithTimeout(ctx, time.Second)
			defer cancel()
			if err := wsjson.Write(ctx, c, &s); err != nil {
				return
			}
			metricSent.Inc()
		}()
	}
	r.room.AddPlayer(playerID, nickname)
	r.sendAll()
	r.mu.Unlock()

	defer func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		delete(r.players, playerID)
		r.room.RemovePlayer(playerID)
		r.sendAll()
	}()

	g.Go(func() error {
		<-ctx.Done()
		return c.Close(websocket.StatusGoingAway, "going away")
	})

	g.Go(func() error {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-ticker.C:
			}

			if err := c.Ping(ctx); err != nil {
				return err
			}

			r.lastSeen.Store(time.Now())
		}
	})

	g.Go(func() error {
		for {
			var note protocol.ClientNote

			if err := wsjson.Read(ctx, c, &note); err != nil {
				return err
			}

			r.lastSeen.Store(time.Now())
			metricReceived.Inc()

			if err := r.handleNote(playerID, &note); err != nil {
				metricHandleErrors.Inc()
				log.Println("error handling note:", err)
				return err
			}
		}
	})

	_ = g.Wait()
}

var errMissingPlayer = errors.New("missing player during handleNote")

func (r *Room) handleNote(playerID game.PlayerID, note *protocol.ClientNote) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// The client's version was wrong; reject and send them the current state.
	if note.Version != r.room.Version {
		p := r.players[playerID]
		if p == nil {
			return errMissingPlayer
		}
		r.sendOne(playerID, p)
		return nil
	}

	before := r.room.Version
	resetTimer := false

	defer func() {
		if r.room.Version != before {
			if r.timed && resetTimer {
				r.startTimer()
			}
			r.sendAll()
		}
	}()

	switch note.Method {
	case protocol.RevealMethod:
		var params protocol.RevealParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		prevTurn := r.room.Turn
		r.room.Reveal(playerID, params.Row, params.Col)
		resetTimer = prevTurn != r.room.Turn

	case protocol.NewGameMethod:
		var params protocol.NewGameParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		resetTimer = true
		r.room.NewGame()

	case protocol.EndTurnMethod:
		var params protocol.EndTurnParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		resetTimer = true
		r.room.EndTurn(playerID)

	case protocol.RandomizeTeamsMethod:
		var params protocol.RandomizeTeamsParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.room.RandomizeTeams()

	case protocol.ChangeTeamMethod:
		var params protocol.ChangeTeamParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.room.ChangeTeam(playerID, params.Team)

	case protocol.ChangeNicknameMethod:
		var params protocol.ChangeNicknameParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}

		// Sync with protocol.go's validation method.
		if len(params.Nickname) == 0 || len(params.Nickname) > 16 {
			return nil
		}

		r.room.AddPlayer(playerID, params.Nickname)

	case protocol.ChangeRoleMethod:
		var params protocol.ChangeRoleParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.room.ChangeRole(playerID, params.Spymaster)

	case protocol.ChangePackMethod:
		var params protocol.ChangePackParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.room.ChangePack(params.Num, params.Enable)

	case protocol.ChangeTurnModeMethod:
		var params protocol.ChangeTurnModeParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.changeTurnMode(params.Timed)

	case protocol.ChangeTurnTimeMethod:
		var params protocol.ChangeTurnTimeParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.changeTurnTime(params.Seconds)

	case protocol.AddPacksMethod:
		var params protocol.AddPacksParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		for _, p := range params.Packs {
			if len(p.Words) < 25 {
				continue
			}
			r.room.AddPack(p.Name, p.Words)
		}

	case protocol.RemovePackMethod:
		var params protocol.RemovePackParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.room.RemovePack(params.Num)

	case protocol.ChangeHideBombMethod:
		var params protocol.ChangeHideBombParams
		if err := json.Unmarshal(note.Params, &params); err != nil {
			return err
		}
		r.changeHideBomb(params.HideBomb)

	default:
		log.Printf("unhandled method: %s", note.Method)
	}

	return nil
}

// Must be called with r.mu locked.
func (r *Room) sendAll() {
	for playerID, sender := range r.players {
		r.sendOne(playerID, sender)
	}
}

// Must be called with r.mu locked.
func (r *Room) sendOne(playerID game.PlayerID, sender noteSender) {
	state := r.createStateFor(playerID)
	note := protocol.StateNote(state)
	sender(note)
}

// Must be called with r.mu locked.
func (r *Room) createStateFor(playerID game.PlayerID) *protocol.State {
	if r.state == nil || r.state.version != r.room.Version {
		r.state = r.createStateCache()
	}

	// Temporary verbose access to attempt to figure out which of these is (impossibly) failing.
	room := r.room
	players := room.Players
	player := players[playerID]
	spymaster := player.Spymaster

	if spymaster {
		return r.state.spymaster
	}
	return r.state.guesser
}

type stateCache struct {
	version   int
	guesser   *protocol.State
	spymaster *protocol.State
}

func (r *Room) createStateCache() *stateCache {
	return &stateCache{
		version:   r.room.Version,
		guesser:   r.createRoomState(false),
		spymaster: r.createRoomState(true),
	}
}

func (r *Room) createRoomState(spymaster bool) *protocol.State {
	room := r.room

	s := &protocol.State{
		Version:   room.Version,
		Teams:     make([][]*protocol.StatePlayer, len(room.Teams)),
		Turn:      room.Turn,
		Winner:    room.Winner,
		Board:     make([][]*protocol.StateTile, room.Board.Rows),
		WordsLeft: room.Board.WordCounts,
		Lists:     make([]*protocol.StateWordList, len(room.WordLists)),
		HideBomb:  r.hideBomb,
	}

	if r.turnDeadline != nil {
		s.Timer = &protocol.StateTimer{
			TurnTime: r.turnSeconds,
			TurnEnd:  *r.turnDeadline,
		}
	}

	for team, members := range room.Teams {
		for _, id := range members {
			p := room.Players[id]
			s.Teams[team] = append(s.Teams[team], &protocol.StatePlayer{
				PlayerID:  id,
				Nickname:  p.Nickname,
				Spymaster: p.Spymaster,
			})
		}

		if s.Teams[team] == nil {
			s.Teams[team] = []*protocol.StatePlayer{}
		}
	}

	for row := range s.Board {
		tiles := make([]*protocol.StateTile, room.Board.Cols)
		for col := range tiles {
			tile := room.Board.Get(row, col)
			sTile := &protocol.StateTile{
				Word:     tile.Word,
				Revealed: tile.Revealed,
			}

			if spymaster || tile.Revealed || room.Winner != nil {
				view := &protocol.StateView{
					Team:    tile.Team,
					Neutral: tile.Neutral,
					Bomb:    tile.Bomb,
				}

				if view.Bomb && !tile.Revealed && room.Winner == nil && r.hideBomb {
					view.Neutral = true
					view.Bomb = false
				}

				sTile.View = view
			}

			tiles[col] = sTile
		}

		s.Board[row] = tiles
	}

	for i, wl := range room.WordLists {
		s.Lists[i] = &protocol.StateWordList{
			Name:    wl.Name,
			Count:   wl.List.Len(),
			Custom:  wl.Custom,
			Enabled: wl.Enabled,
		}
	}

	return s
}

// Must be called with r.mu locked.
func (r *Room) changeTurnMode(timed bool) {
	if r.timed == timed {
		return
	}

	r.timed = timed

	if timed {
		r.startTimer()
	} else {
		r.stopTimer()
	}

	r.room.Version++
}

// Must be called with r.mu locked.
func (r *Room) changeTurnTime(seconds int) {
	if seconds <= 0 || r.turnSeconds == seconds {
		return
	}

	r.turnSeconds = seconds

	if r.timed {
		r.startTimer()
	}

	r.room.Version++
}

func (r *Room) timerEndTurn() {
	r.mu.Lock()
	defer r.mu.Unlock()

	stopped := r.stopTimer()
	if !stopped {
		// Room was pruned.
		return
	}

	r.turnTimer = nil
	r.turnDeadline = nil

	if r.room.Winner != nil || r.turnSeconds == 0 {
		return
	}

	r.room.ForceEndTurn()
	r.startTimer()
	r.sendAll()
}

// Must be called with r.mu locked.
func (r *Room) stopTimer() (stopped bool) {
	if r.turnTimer != nil {
		r.turnTimer.Stop()
		stopped = true
	}
	r.turnTimer = nil
	r.turnDeadline = nil
	return stopped
}

// Must be called with r.mu locked.
func (r *Room) startTimer() {
	if !r.timed {
		panic("startTimer called on non-timed room")
	}

	if r.turnTimer != nil {
		r.turnTimer.Stop()
	}

	dur := time.Second * time.Duration(r.turnSeconds)
	deadline := time.Now().Add(dur)
	r.turnDeadline = &deadline
	r.turnTimer = time.AfterFunc(dur, r.timerEndTurn)
}

// Must be called with r.mu locked.
func (r *Room) changeHideBomb(HideBomb bool) {
	if r.hideBomb == HideBomb {
		return
	}

	r.hideBomb = HideBomb
	r.room.Version++
}
