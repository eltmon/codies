package static

import "github.com/zikaeroh/codies/internal/words"

//go:generate go run github.com/mjibson/esc -o=esc.go -pkg=static -ignore=^(static|esc)\.go$ -modtime=0 -private .

var (
	Default    = words.NewListFromLines(_escFSMustString(false, "/codenames/default.txt"))
	Duet       = words.NewListFromLines(_escFSMustString(false, "/codenames/duet.txt"))
	Undercover = words.NewListFromLines(_escFSMustString(false, "/codenames/undercover.txt"))
)
