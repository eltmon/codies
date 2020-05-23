package game

import (
	"github.com/gofrs/uuid"
	"github.com/zikaeroh/codies/internal/words"
	"github.com/zikaeroh/codies/internal/words/static"
)

type PlayerID = uuid.UUID

type WordList struct {
	Name   string
	Custom bool
	List   words.List

	Enabled bool
}

func defaultWords() []*WordList {
	return []*WordList{
		{
			Name:    "Base",
			List:    static.Default,
			Enabled: true,
		},
		{
			Name: "Duet",
			List: static.Duet,
		},
		{
			Name: "Undercover",
			List: static.Undercover,
		},
	}
}

type Room struct {
	rand Rand

	// Configuration for the next new game.
	Rows, Cols int

	Version   int
	Board     *Board
	Turn      Team
	Winner    *Team
	Players   map[PlayerID]*Player
	Teams     [][]PlayerID // To preserve the ordering of teams.
	WordLists []*WordList
}

func NewRoom(rand Rand) *Room {
	if rand == nil {
		rand = globalRand{}
	}

	return &Room{
		rand:      rand,
		Rows:      5,
		Cols:      5,
		Players:   make(map[PlayerID]*Player),
		Teams:     make([][]PlayerID, 2), // TODO: support more than 2 teams
		WordLists: defaultWords(),
	}
}

type Player struct {
	ID        PlayerID
	Nickname  string
	Team      Team
	Spymaster bool
}

func (r *Room) AddPlayer(id PlayerID, nickname string) {
	if p, ok := r.Players[id]; ok {
		if p.Nickname == nickname {
			return
		}

		p.Nickname = nickname
		r.Version++
		return
	}

	team := r.smallestTeam()
	p := &Player{
		ID:       id,
		Nickname: nickname,
		Team:     team,
	}

	r.Players[id] = p
	r.Teams[team] = append(r.Teams[team], id)
	r.Version++
}

func (r *Room) smallestTeam() Team {
	min := Team(0)
	minLen := len(r.Teams[0])

	for tInt, team := range r.Teams {
		if len(team) < minLen {
			min = Team(tInt)
			minLen = len(team)
		}
	}

	return min
}

func (r *Room) words() (list words.List) {
	for _, w := range r.WordLists {
		if w.Enabled {
			list = list.Concat(w.List)
		}
	}
	return list
}

func (r *Room) NewGame() {
	words := r.words()

	if r.Rows*r.Cols > words.Len() {
		panic("not enough words")
	}

	r.Version++
	r.Winner = nil
	r.Turn = Team(r.rand.Intn(len(r.Teams)))
	r.Board = newBoard(r.Rows, r.Cols, words, r.Turn, len(r.Teams), r.rand)
}

func (r *Room) EndTurn(id PlayerID) {
	if r.Winner != nil {
		return
	}

	p := r.Players[id]
	if p == nil {
		return
	}

	if p.Team != r.Turn || p.Spymaster {
		return
	}

	r.ForceEndTurn()
}

func (r *Room) nextTeam() Team {
	return r.Turn.next(len(r.Teams))
}

func (r *Room) nextTurn() {
	r.Turn = r.nextTeam()
}

func (r *Room) ForceEndTurn() {
	r.Version++
	r.nextTurn()
}

func (r *Room) RemovePlayer(id PlayerID) {
	p := r.Players[id]
	if p == nil {
		return
	}

	r.Version++
	delete(r.Players, id)

	r.Teams[p.Team] = removePlayer(r.Teams[p.Team], id)
}

func (r *Room) Reveal(id PlayerID, row, col int) {
	if r.Winner != nil {
		return
	}

	p := r.Players[id]
	if p == nil {
		return
	}

	if p.Spymaster || p.Team != r.Turn {
		return
	}

	tile := r.Board.Get(row, col)
	if tile == nil {
		return
	}

	if tile.Revealed {
		return
	}

	tile.Revealed = true

	switch {
	case tile.Neutral:
		r.nextTurn()
	case tile.Bomb:
		// TODO: Who wins when there's more than one team?
		// Maybe eliminate the team who clicked?
		winner := r.nextTeam()
		r.Winner = &winner
	default:
		r.Board.WordCounts[tile.Team]--
		if r.Board.WordCounts[tile.Team] == 0 {
			winner := tile.Team
			r.Winner = &winner
		} else if tile.Team != p.Team {
			r.nextTurn()
		}
	}

	r.Version++
}

func (r *Room) ChangeRole(id PlayerID, spymaster bool) {
	if r.Winner != nil {
		return
	}

	p := r.Players[id]
	if p == nil {
		return
	}

	if p.Spymaster == spymaster {
		return
	}

	p.Spymaster = spymaster
	r.Version++
}

func (r *Room) ChangeTeam(id PlayerID, team Team) {
	if team < 0 || int(team) >= len(r.Teams) {
		return
	}

	p := r.Players[id]
	if p == nil {
		return
	}

	if p.Team == team {
		return
	}

	r.Teams[p.Team] = removePlayer(r.Teams[p.Team], id)
	r.Teams[team] = append(r.Teams[team], id)
	p.Team = team
	r.Version++
}

func removePlayer(team []PlayerID, remove PlayerID) []PlayerID {
	newTeam := make([]PlayerID, 0, len(team)-1)
	for _, id := range team {
		if id != remove {
			newTeam = append(newTeam, id)
		}
	}
	return newTeam
}

func (r *Room) RandomizeTeams() {
	players := make([]PlayerID, 0, len(r.Players))
	for id := range r.Players {
		players = append(players, id)
	}

	r.rand.Shuffle(len(players), func(i, j int) {
		players[i], players[j] = players[j], players[i]
	})

	numTeams := len(r.Teams)
	newTeams := make([][]PlayerID, numTeams)
	for i := range newTeams {
		newTeams[i] = make([]PlayerID, 0, len(players)/numTeams)
	}

	for i, id := range players {
		team := i % numTeams
		newTeams[team] = append(newTeams[team], id)
	}

	r.rand.Shuffle(numTeams, func(i, j int) {
		newTeams[i], newTeams[j] = newTeams[j], newTeams[i]
	})

	for team, players := range newTeams {
		for _, id := range players {
			r.Players[id].Team = Team(team)
		}
	}

	r.Teams = newTeams
	r.Version++
}

func (r *Room) ChangePack(num int, enable bool) {
	if num < 0 || num >= len(r.WordLists) {
		return
	}

	pack := r.WordLists[num]

	if pack.Enabled == enable {
		return
	}

	if !enable {
		total := 0
		for _, p := range r.WordLists {
			if p.Enabled {
				total++
			}
		}

		if total < 2 {
			return
		}
	}

	pack.Enabled = enable
	r.Version++
}

func (r *Room) AddPack(name string, wds []string) {
	if len(r.WordLists) >= 10 {
		return
	}

	list := &WordList{
		Name:   name,
		Custom: true,
		List:   words.NewList(wds),
	}
	r.WordLists = append(r.WordLists, list)
	r.Version++
}

func (r *Room) RemovePack(num int) {
	if num < 0 || num >= len(r.WordLists) {
		return
	}

	if pack := r.WordLists[num]; !pack.Custom || pack.Enabled {
		return
	}

	// https://github.com/golang/go/wiki/SliceTricks
	lists := r.WordLists
	copy(lists[num:], lists[num+1:])
	lists[len(lists)-1] = nil
	lists = lists[:len(lists)-1]
	r.WordLists = lists

	r.Version++
}
