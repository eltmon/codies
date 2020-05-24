package main

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"reflect"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/gofrs/uuid"
	"github.com/jessevdk/go-flags"
	"github.com/posener/ctxutil"
	"github.com/tomwright/queryparam/v4"
	"github.com/zikaeroh/codies/internal/protocol"
	"github.com/zikaeroh/codies/internal/server"
	"github.com/zikaeroh/codies/internal/version"
	"golang.org/x/sync/errgroup"
	"nhooyr.io/websocket"
)

var args = struct {
	Addr    string   `long:"addr" env:"CODIES_ADDR" description:"Address to listen at"`
	Origins []string `long:"origins" env:"CODIES_ORIGINS" env-delim:"," description:"Additional valid origins for WebSocket connections"`
	Debug   bool     `long:"debug" env:"CODIES_DEBUG" description:"Enables debug mode"`
}{
	Addr: ":5000",
}

func main() {
	rand.Seed(time.Now().Unix())
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if _, err := flags.Parse(&args); err != nil {
		// Default flag parser prints messages, so just exit.
		os.Exit(1)
	}

	log.Printf("starting codies server, version %s", version.Version())

	wsOpts := &websocket.AcceptOptions{
		OriginPatterns: args.Origins,
	}

	if args.Debug {
		log.Println("starting in debug mode, allowing any WebSocket origin host")
		wsOpts.OriginPatterns = []string{"*"}
	}

	g, ctx := errgroup.WithContext(ctxutil.Interrupt())

	srv := server.NewServer()

	r := chi.NewMux()
	r.Use(middleware.Heartbeat("/ping"))
	r.Use(middleware.Recoverer)
	r.NotFound(staticRouter().ServeHTTP)

	r.Group(func(r chi.Router) {
		r.Use(middleware.NoCache)

		r.Get("/api/time", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(&protocol.TimeResponse{Time: time.Now()})
		})

		r.Get("/api/exists", func(w http.ResponseWriter, r *http.Request) {
			query := &protocol.ExistsQuery{}
			if err := queryparam.Parse(r.URL.Query(), query); err != nil {
				httpErr(w, http.StatusBadRequest)
				return
			}

			room := srv.FindRoomByID(query.RoomID)
			if room == nil {
				w.WriteHeader(http.StatusNotFound)
			} else {
				w.WriteHeader(http.StatusOK)
			}

			_, _ = w.Write([]byte("."))
		})

		r.Post("/api/room", func(w http.ResponseWriter, r *http.Request) {
			defer r.Body.Close()

			req := &protocol.RoomRequest{}
			if err := json.NewDecoder(r.Body).Decode(req); err != nil {
				httpErr(w, http.StatusBadRequest)
				return
			}

			if !req.Valid() {
				httpErr(w, http.StatusBadRequest)
				return
			}

			resp := &protocol.RoomResponse{}

			w.Header().Add("Content-Type", "application/json")

			if req.Create {
				room, err := srv.CreateRoom(req.RoomName, req.RoomPass)
				if err != nil {
					switch err {
					case server.ErrRoomExists:
						resp.Error = stringPtr("Room already exists.")
						w.WriteHeader(http.StatusBadRequest)
					case server.ErrTooManyRooms:
						resp.Error = stringPtr("Too many rooms.")
						w.WriteHeader(http.StatusServiceUnavailable)
					default:
						resp.Error = stringPtr("An unknown error occurred.")
						w.WriteHeader(http.StatusInternalServerError)
					}
				} else {
					resp.ID = &room.ID
					w.WriteHeader(http.StatusOK)
				}
			} else {
				room := srv.FindRoom(req.RoomName)
				if room == nil || room.Password != req.RoomPass {
					resp.Error = stringPtr("Room not found or password does not match.")
					w.WriteHeader(http.StatusNotFound)
				} else {
					resp.ID = &room.ID
					w.WriteHeader(http.StatusOK)
				}
			}

			_ = json.NewEncoder(w).Encode(resp)
		})

		r.Get("/api/ws", func(w http.ResponseWriter, r *http.Request) {
			query := &protocol.WSQuery{}
			if err := queryparam.Parse(r.URL.Query(), query); err != nil {
				httpErr(w, http.StatusBadRequest)
				return
			}

			if !query.Valid() {
				httpErr(w, http.StatusBadRequest)
				return
			}

			room := srv.FindRoomByID(query.RoomID)
			if room == nil {
				httpErr(w, http.StatusNotFound)
				return
			}

			c, err := websocket.Accept(w, r, wsOpts)
			if err != nil {
				log.Println(err)
				return
			}

			g.Go(func() error {
				room.HandleConn(query.PlayerID, query.Nickname, c)
				return nil
			})
		})

		r.Get("/api/stats", func(w http.ResponseWriter, r *http.Request) {
			rooms, clients := srv.Stats()

			enc := json.NewEncoder(w)
			enc.SetIndent("", "    ")
			_ = enc.Encode(&protocol.StatsResponse{
				Rooms:   rooms,
				Clients: clients,
			})
		})
	})

	g.Go(func() error {
		return srv.Run(ctx)
	})

	httpSrv := http.Server{Addr: args.Addr, Handler: r}

	g.Go(func() error {
		<-ctx.Done()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		return httpSrv.Shutdown(ctx)
	})

	g.Go(func() error {
		return httpSrv.ListenAndServe()
	})

	log.Fatal(g.Wait())
}

func staticRouter() http.Handler {
	fs := http.Dir("./frontend/build")
	fsh := http.FileServer(fs)

	r := chi.NewMux()
	r.Use(middleware.Compress(5))

	r.Handle("/static/*", fsh)
	r.Handle("/favicon/*", fsh)

	r.Group(func(r chi.Router) {
		r.Use(middleware.NoCache)
		r.Handle("/*", fsh)
	})

	return r
}

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
