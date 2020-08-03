package game

import (
	"sort"
	"testing"

	"gotest.tools/v3/assert"
)

func TestLayouts(t *testing.T) {
	for key, layout := range layouts {
		assert.Equal(t, len(layout.teams), key.numTeams)

		sum := layout.bomb + layout.neutral
		for _, x := range layout.teams {
			sum += x
		}

		assert.Equal(t, sum, key.boardSize)

		assert.Assert(t, sort.SliceIsSorted(layout.teams, func(i, j int) bool {
			return layout.teams[i] >= layout.teams[j] //nolint:scopelint
		}))
	}
}
