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

	metricReceived = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "received_total",
		Help:      "Total number of received messages.",
	})

	metricSent = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "sent_total",
		Help:      "Total number of sent messages.",
	})

	metricHandleErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "codies",
		Subsystem: "codies",
		Name:      "handle_error_total",
		Help:      "Total number of handle errors.",
	})
)
