package protocol

import (
	"time"

	"github.com/gofrs/uuid"
	"github.com/mailru/easyjson"
	"github.com/zikaeroh/codies/internal/game"
)

// See protocol/index.ts.

//go:generate go run github.com/mailru/easyjson/easyjson -disallow_unknown_fields protocol.go

type ExistsQuery struct {
	RoomID string `queryparam:"roomID"`
}

//easyjson:json
type RoomRequest struct {
	RoomName string `json:"roomName"`
	RoomPass string `json:"roomPass"`
	Create   bool   `json:"create"`
}

func (r *RoomRequest) Valid() bool {
	if len(r.RoomName) < 3 || len(r.RoomName) > 16 {
		return false
	}

	if len(r.RoomPass) == 0 {
		return false
	}

	return true
}

//easyjson:json
type RoomResponse struct {
	ID    *string `json:"id,omitempty"`
	Error *string `json:"error,omitempty"`
}

//easyjson:json
type TimeResponse struct {
	Time time.Time `json:"time"`
}

//easyjson:json
type StatsResponse struct {
	Rooms   int `json:"rooms"`
	Clients int `json:"clients"`
}

type WSQuery struct {
	RoomID   string    `queryparam:"roomID"`
	PlayerID uuid.UUID `queryparam:"playerID"`
	Nickname string    `queryparam:"nickname"`
}

func (w *WSQuery) Valid() bool {
	if w.RoomID == "" {
		return false
	}

	if w.PlayerID == uuid.Nil {
		return false
	}

	if len(w.Nickname) < 3 || len(w.Nickname) > 16 {
		return false
	}

	return true
}

//easyjson:json
type ClientNote struct {
	Method  ClientMethod        `json:"method"`
	Version int                 `json:"version"`
	Params  easyjson.RawMessage `json:"params"`
}

type ClientMethod string

const NewGameMethod = ClientMethod("newGame")

//easyjson:json
type NewGameParams struct{}

const EndTurnMethod = ClientMethod("endTurn")

//easyjson:json
type EndTurnParams struct{}

const RandomizeTeamsMethod = ClientMethod("randomizeTeams")

//easyjson:json
type RandomizeTeamsParams struct{}

const RevealMethod = ClientMethod("reveal")

//easyjson:json
type RevealParams struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

const ChangeTeamMethod = ClientMethod("changeTeam")

//easyjson:json
type ChangeTeamParams struct {
	Team game.Team `json:"team"`
}

const ChangeNicknameMethod = ClientMethod("changeNickname")

//easyjson:json
type ChangeNicknameParams struct {
	Nickname string `json:"nickname"`
}

const ChangeRoleMethod = ClientMethod("changeRole")

//easyjson:json
type ChangeRoleParams struct {
	Spymaster bool `json:"spymaster"`
}

const ChangePackMethod = ClientMethod("changePack")

//easyjson:json
type ChangePackParams struct {
	Num    int  `json:"num"`
	Enable bool `json:"enable"`
}

const ChangeTurnModeMethod = ClientMethod("changeTurnMode")

//easyjson:json
type ChangeTurnModeParams struct {
	Timed bool `json:"timed"`
}

const ChangeTurnTimeMethod = ClientMethod("changeTurnTime")

//easyjson:json
type ChangeTurnTimeParams struct {
	Seconds int `json:"seconds"`
}

const AddPacksMethod = ClientMethod("addPacks")

//easyjson:json
type AddPacksParams struct {
	Packs []struct {
		Name  string   `json:"name"`
		Words []string `json:"words"`
	} `json:"packs"`
}

const RemovePackMethod = ClientMethod("removePack")

//easyjson:json
type RemovePackParams struct {
	Num int `json:"num"`
}

type ServerMethod string

//easyjson:json
type ServerNote struct {
	Method ServerMethod `json:"method"`
	Params interface{}  `json:"params"`
}

func StateNote(s *State) ServerNote {
	return ServerNote{
		Method: "state",
		Params: s,
	}
}

//easyjson:json
type State struct {
	Version   int              `json:"version"`
	Teams     [][]*StatePlayer `json:"teams"`
	Turn      game.Team        `json:"turn"`
	Winner    *game.Team       `json:"winner"`
	Board     [][]*StateTile   `json:"board"`
	WordsLeft []int            `json:"wordsLeft"`
	Lists     []*StateWordList `json:"lists"`
	Timer     *StateTimer      `json:"timer"`
}

//easyjson:json
type StatePlayer struct {
	PlayerID  game.PlayerID `json:"playerID"`
	Nickname  string        `json:"nickname"`
	Spymaster bool          `json:"spymaster"`
}

//easyjson:json
type StateTile struct {
	Word     string     `json:"word"`
	Revealed bool       `json:"revealed"`
	View     *StateView `json:"view"`
}

//easyjson:json
type StateView struct {
	Team    game.Team `json:"team"`
	Neutral bool      `json:"neutral"`
	Bomb    bool      `json:"bomb"`
}

//easyjson:json
type StateWordList struct {
	Name    string `json:"name"`
	Count   int    `json:"count"`
	Custom  bool   `json:"custom"`
	Enabled bool   `json:"enabled"`
}

//easyjson:json
type StateTimer struct {
	TurnTime int       `json:"turnTime"`
	TurnEnd  time.Time `json:"turnEnd"`
}
