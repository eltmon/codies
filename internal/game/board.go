package game

import (
	"github.com/zikaeroh/codies/internal/words"
)

// Team number, starting at zero.
type Team int

func (t Team) next(numTeams int) Team {
	return (t + 1) % Team(numTeams)
}

type Tile struct {
	// Immutable
	Word    string
	Team    Team
	Neutral bool
	Bomb    bool

	// Mutable
	Revealed bool
}

type Board struct {
	Rows, Cols int
	WordCounts []int
	tiles      []*Tile // len(items)=rows*cols, access via items[row*rows + col]
}

func newBoard(rows, cols int, words words.List, startingTeam Team, numTeams int, rand Rand) *Board {
	if startingTeam < 0 || int(startingTeam) >= numTeams {
		panic("invalid starting team")
	}

	n := rows * cols
	layout, ok := layouts[layoutKey{boardSize: n, numTeams: numTeams}]
	if !ok {
		panic("invalid board dimension")
	}

	// Copy and rotate teams to give the first team the most words.
	old := layout.teams
	layout.teams = append([]int(nil), old[startingTeam:]...)
	layout.teams = append(layout.teams, old[:startingTeam]...)
	wordCounts := append([]int(nil), layout.teams...)

	items := make([]*Tile, n)
	seen := make(map[int]struct{}, n)

	for i := range items {
		var w string
		for {
			j := rand.Intn(words.Len())
			if _, ok := seen[j]; !ok {
				seen[j] = struct{}{}
				w = words.Get(j)
				break
			}
		}

		item := &Tile{Word: w}

	ItemSwitch:
		switch {
		case layout.bomb > 0:
			layout.bomb--
			item.Bomb = true

		case layout.neutral > 0:
			layout.neutral--
			item.Neutral = true

		default:
			for t, c := range layout.teams {
				if c == 0 {
					continue
				}

				layout.teams[t]--
				item.Team = Team(t)
				break ItemSwitch
			}

			panic("unreachable")
		}

		items[i] = item
	}

	rand.Shuffle(len(items), func(i, j int) {
		items[i], items[j] = items[j], items[i]
	})

	return &Board{
		Rows:       rows,
		Cols:       cols,
		WordCounts: wordCounts,
		tiles:      items,
	}
}

func (b *Board) Get(row, col int) *Tile {
	switch {
	case row < 0:
	case col < 0:
	case row >= b.Rows:
	case col >= b.Cols:
	default:
		i := row*b.Rows + col
		return b.tiles[i]
	}

	return nil
}
