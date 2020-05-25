package server

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	metricRooms = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "rooms",
		Help:      "Total number of rooms.",
	})

	metricClients = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "clients",
		Help:      "Total number of clients.",
	})

	metricRecieved = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "recieved_total",
		Help:      "Total number of recieved messages.",
	})

	metricSent = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "sent_total",
		Help:      "Total number of sent messages.",
	})
)
