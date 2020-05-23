package game

import "math/rand"

type Rand interface {
	Intn(n int) int
	Shuffle(n int, swap func(i, j int))
}

type globalRand struct{}

var _ Rand = globalRand{}

func (globalRand) Intn(n int) int {
	return rand.Intn(n)
}

func (globalRand) Shuffle(n int, swap func(i, j int)) {
	rand.Shuffle(n, swap)
}
