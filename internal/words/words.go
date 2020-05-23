package words

import (
	"bufio"
	"strings"
)

type List struct {
	words [][]string
	len   int
}

func newList(words []string) List {
	return List{
		words: [][]string{words},
		len:   len(words),
	}
}

func NewList(words []string) List {
	cleaned := make([]string, 0, len(words))
	for _, w := range words {
		w = strings.TrimSpace(w)
		w = strings.ToUpper(w)
		cleaned = append(cleaned, w)
	}
	return newList(cleaned)
}

func NewListFromLines(s string) List {
	s = strings.TrimSpace(s)
	words := make([]string, 0, strings.Count(s, "\n"))
	scanner := bufio.NewScanner(strings.NewReader(s))

	for scanner.Scan() {
		word := scanner.Text()
		word = strings.TrimSpace(word)
		word = strings.ToUpper(word)
		words = append(words, word)
	}

	return newList(words)
}

func (l *List) Len() int {
	return l.len
}

func (l *List) Get(i int) string {
	for _, words := range l.words {
		if i < len(words) {
			return words[i]
		}
		i -= len(words)
	}
	panic("out of bounds")
}

func (l List) Concat(other List) List {
	words := make([][]string, 0, len(l.words)+len(other.words))
	words = append(words, l.words...)
	words = append(words, other.words...)

	return List{
		words: words,
		len:   l.len + other.len,
	}
}
