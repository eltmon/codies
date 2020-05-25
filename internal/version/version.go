// Package version provides a global version string.
package version

var version string

// Version returns a compile time version string, or "(devel)" if unset.
func Version() string {
	if version == "" {
		return "(devel)"
	}
	return version
}

// VersionSet returns true if the verison has been set.
func VersionSet() bool {
	return version != ""
}
