package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/jessevdk/go-flags"
	"github.com/posener/ctxutil"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/tomwright/queryparam/v4"
	"github.com/zikaeroh/codies/internal/protocol"
	"github.com/zikaeroh/codies/internal/responder"
	"github.com/zikaeroh/codies/internal/server"
	"github.com/zikaeroh/codies/internal/version"
	"golang.org/x/sync/errgroup"
	"nhooyr.io/websocket"
)

var args = struct {
	Addr    string   `long:"addr" env:"CODIES_ADDR" description:"Address to listen at"`
	Origins []string `long:"origins" env:"CODIES_ORIGINS" env-delim:"," description:"Additional valid origins for WebSocket connections"`
	Prod    bool     `long:"prod" env:"CODIES_PROD" description:"Enables production mode"`
	Debug   bool     `long:"debug" env:"CODIES_DEBUG" description:"Enables debug mode"`
}{
	Addr: ":5000",
}

var wsOpts *websocket.AcceptOptions

func main() {
	rand.Seed(time.Now().Unix())
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if _, err := flags.Parse(&args); err != nil {
		// Default flag parser prints messages, so just exit.
		os.Exit(1)
	}

	if !args.Prod && !args.Debug {
		log.Fatal("missing required option --prod or --debug")
	} else if args.Prod && args.Debug {
		log.Fatal("must specify either --prod or --debug")
	}

	log.Printf("starting codies server, version %s", version.Version())

	wsOpts = &websocket.AcceptOptions{
		OriginPatterns:  args.Origins,
		CompressionMode: websocket.CompressionContextTakeover,
	}

	if args.Debug {
		log.Println("starting in debug mode, allowing any WebSocket origin host")
		wsOpts.InsecureSkipVerify = true
	} else {
		if !version.VersionSet() {
			log.Fatal("running production build without version set")
		}
	}

	g, ctx := errgroup.WithContext(ctxutil.Interrupt())

	srv := server.NewServer()

	r := chi.NewMux()

	r.Use(func(next http.Handler) http.Handler {
		return promhttp.InstrumentHandlerCounter(metricRequest, next)
	})

	r.Use(middleware.Heartbeat("/ping"))
	r.Use(middleware.Recoverer)
	r.NotFound(staticHandler().ServeHTTP)

	r.Group(func(r chi.Router) {
		r.Use(middleware.NoCache)

		r.Get("/api/time", func(w http.ResponseWriter, r *http.Request) {
			responder.Respond(w, responder.Body(&protocol.TimeResponse{Time: time.Now()}))
		})

		r.Get("/api/stats", func(w http.ResponseWriter, r *http.Request) {
			rooms, clients := srv.Stats()
			responder.Respond(w,
				responder.Body(&protocol.StatsResponse{
					Rooms:   rooms,
					Clients: clients,
				}),
				responder.Pretty(true),
			)
		})

		r.Group(func(r chi.Router) {
			if !args.Debug {
				r.Use(checkVersion)
			}

			r.Get("/api/exists", func(w http.ResponseWriter, r *http.Request) {
				query := &protocol.ExistsQuery{}
				if err := queryparam.Parse(r.URL.Query(), query); err != nil {
					responder.Respond(w, responder.Status(http.StatusBadRequest))
					return
				}

				room := srv.FindRoomByID(query.RoomID)
				if room == nil {
					responder.Respond(w, responder.Status(http.StatusNotFound))
				} else {
					responder.Respond(w, responder.Status(http.StatusOK))
				}
			})

			r.Post("/api/room", func(w http.ResponseWriter, r *http.Request) {
				defer r.Body.Close()

				req := &protocol.RoomRequest{}
				if err := json.NewDecoder(r.Body).Decode(req); err != nil {
					responder.Respond(w, responder.Status(http.StatusBadRequest))
					return
				}

				if msg, valid := req.Valid(); !valid {
					responder.Respond(w,
						responder.Status(http.StatusBadRequest),
						responder.Body(&protocol.RoomResponse{
							Error: stringPtr(msg),
						}),
					)
					return
				}

				var room *server.Room
				if req.Create {
					var err error
					room, err = srv.CreateRoom(req.RoomName, req.RoomPass)
					if err != nil {
						switch err {
						case server.ErrRoomExists:
							responder.Respond(w,
								responder.Status(http.StatusBadRequest),
								responder.Body(&protocol.RoomResponse{
									Error: stringPtr("Room already exists."),
								}),
							)
						case server.ErrTooManyRooms:
							responder.Respond(w,
								responder.Status(http.StatusServiceUnavailable),
								responder.Body(&protocol.RoomResponse{
									Error: stringPtr("Too many rooms."),
								}),
							)
						default:
							responder.Respond(w,
								responder.Status(http.StatusInternalServerError),
								responder.Body(&protocol.RoomResponse{
									Error: stringPtr("An unknown error occurred."),
								}),
							)
						}
						return
					}
				} else {
					room = srv.FindRoom(req.RoomName)
					if room == nil || room.Password != req.RoomPass {
						responder.Respond(w,
							responder.Status(http.StatusNotFound),
							responder.Body(&protocol.RoomResponse{
								Error: stringPtr("Room not found or password does not match."),
							}),
						)
						return
					}
				}

				responder.Respond(w, responder.Body(&protocol.RoomResponse{
					ID: &room.ID,
				}))
			})

			r.Get("/api/ws", func(w http.ResponseWriter, r *http.Request) {
				query := &protocol.WSQuery{}
				if err := queryparam.Parse(r.URL.Query(), query); err != nil {
					responder.Respond(w, responder.Status(http.StatusBadRequest))
					return
				}

				if _, valid := query.Valid(); !valid {
					responder.Respond(w, responder.Status(http.StatusBadRequest))
					return
				}

				room := srv.FindRoomByID(query.RoomID)
				if room == nil {
					responder.Respond(w, responder.Status(http.StatusBadRequest))
					return
				}

				c, err := websocket.Accept(w, r, wsOpts)
				if err != nil {
					return
				}

				g.Go(func() error {
					room.HandleConn(query.PlayerID, query.Nickname, c)
					return nil
				})
			})
		})
	})

	g.Go(func() error {
		return srv.Run(ctx)
	})

	runServer(ctx, g, args.Addr, r)

	if args.Prod {
		runServer(ctx, g, ":2112", prometheusHandler())
	}

	log.Fatal(g.Wait())
}

func staticHandler() http.Handler {
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

func checkVersion(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		want := version.Version()

		toCheck := []string{
			r.Header.Get("X-CODIES-VERSION"),
			r.URL.Query().Get("codiesVersion"),
		}

		for _, got := range toCheck {
			if got == want {
				next.ServeHTTP(w, r)
				return
			}
		}

		reason := fmt.Sprintf("client version too old, please reload to get %s", want)

		if r.Header.Get("Upgrade") == "websocket" {
			c, err := websocket.Accept(w, r, wsOpts)
			if err != nil {
				return
			}
			c.Close(4418, reason)
			return
		}

		w.WriteHeader(http.StatusTeapot)
		fmt.Fprint(w, reason)
	})
}

func runServer(ctx context.Context, g *errgroup.Group, addr string, handler http.Handler) {
	httpSrv := http.Server{Addr: addr, Handler: handler}

	g.Go(func() error {
		<-ctx.Done()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		return httpSrv.Shutdown(ctx)
	})

	g.Go(func() error {
		return httpSrv.ListenAndServe()
	})
}

func prometheusHandler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	return mux
}
