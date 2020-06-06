package static_test

import (
	"testing"

	"github.com/zikaeroh/codies/internal/words"
	"github.com/zikaeroh/codies/internal/words/static"
	"gotest.tools/v3/assert"
)

func TestLen(t *testing.T) {
	testLen := func(t *testing.T, name string, list words.List, want int) {
		t.Helper()
		assert.Equal(t, list.Len(), want)
	}

	testLen(t, "Default", static.Default, 400)
	testLen(t, "Duet", static.Duet, 400)
	testLen(t, "Undercover", static.Undercover, 390)
}
