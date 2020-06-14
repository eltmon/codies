// Package uid generates unique IDs.
package uid

import (
	"github.com/speps/go-hashids"
	"go.uber.org/atomic"
)

// Generator generates unique incrementing IDs. These IDs are only comparable
// with other IDs from this generator.
type Generator struct {
	hid  *hashids.HashID
	next atomic.Int64
}

// NewGenerator creates a new Generator with the specified salt. Generators
// with the same salt generate the same IDs in order.
func NewGenerator(salt string) *Generator {
	hd := hashids.NewData()
	hd.MinLength = 8
	hd.Salt = salt
	hid, err := hashids.NewWithData(hd)
	if err != nil {
		panic(err)
	}

	return &Generator{
		hid: hid,
	}
}

// Next gets the next ID, in both an encoded string form and the raw integer form.
func (g *Generator) Next() (string, int64) {
	v := g.next.Inc()
	id, err := g.hid.EncodeInt64([]int64{v})
	if err != nil {
		panic(err)
	}
	return id, v
}
