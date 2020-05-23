package game

type layoutKey struct {
	boardSize int
	numTeams  int
}

var layouts = map[layoutKey]struct {
	bomb    int
	neutral int
	teams   []int
}{
	{25, 2}: {1, 7, []int{9, 8}},
}
