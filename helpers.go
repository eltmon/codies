package main

import (
	"reflect"

	"github.com/gofrs/uuid"
	"github.com/tomwright/queryparam/v4"
)

func stringPtr(s string) *string {
	return &s
}

func init() {
	queryparam.DefaultParser.ValueParsers[reflect.TypeOf(uuid.UUID{})] = func(value string, _ string) (reflect.Value, error) {
		id, err := uuid.FromString(value)
		return reflect.ValueOf(id), err
	}
}
