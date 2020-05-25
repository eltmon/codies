package main

import (
	"net/http"
	"reflect"

	"github.com/gofrs/uuid"
	"github.com/tomwright/queryparam/v4"
)

func httpErr(w http.ResponseWriter, code int) {
	http.Error(w, http.StatusText(code), code)
}

func stringPtr(s string) *string {
	return &s
}

func init() {
	queryparam.DefaultParser.ValueParsers[reflect.TypeOf(uuid.UUID{})] = func(value string, _ string) (reflect.Value, error) {
		id, err := uuid.FromString(value)
		return reflect.ValueOf(id), err
	}
}
