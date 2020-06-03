package responder

import (
	"encoding/json"
	"net/http"
)

type defaultResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
}

type response struct {
	value  *interface{}
	status int
	pretty bool
}

type Option func(r *response)

func Pretty(pretty bool) Option {
	return func(r *response) {
		r.pretty = pretty
	}
}

func Status(status int) Option {
	return func(r *response) {
		r.status = status
	}
}

func Body(v interface{}) Option {
	return func(r *response) {
		r.value = &v
	}
}

func Respond(w http.ResponseWriter, opts ...Option) {
	r := &response{
		status: http.StatusOK,
	}

	for _, opt := range opts {
		opt(r)
	}

	enc := json.NewEncoder(w)

	if r.pretty {
		enc.SetIndent("    ", "")
	}

	w.Header().Add("Content-Type", "application/json")
	w.WriteHeader(r.status)

	if v := r.value; v != nil {
		_ = enc.Encode(*v)
	} else {
		_ = enc.Encode(&defaultResponse{
			Status:  r.status,
			Message: http.StatusText(r.status),
		})
	}
}
