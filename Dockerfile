FROM node:14 AS JS_BUILD
RUN apt-get update && \
    apt-get install -y --no-install-recommends jq moreutils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /frontend
COPY ./frontend/package.json ./frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY ./frontend ./

# If using environment variables (REACT_APP_*) to pass data in at build-time,
# sometimes the values end up in the library code bundles. This means that changing
# the verison (as below) would invalidate everyone's caches even if the actual code
# didn't change. To avoid this, resort to using a JSON file that is edited before build.
ARG version
RUN jq ".version = \"${version}\"" ./src/metadata.json | sponge ./src/metadata.json
RUN yarn build

FROM golang:1.14 as GO_BUILD
WORKDIR /codies
COPY ./go.mod ./go.sum ./
RUN go mod download
# Manually copying the required files to make this image's cache only include Go code.
COPY ./main.go ./main.go
COPY ./internal ./internal

ARG version
RUN go build  -ldflags="-X github.com/zikaeroh/codies/internal/version.version=${version}" .

# TODO: Use distroless/static and statically compile above. (https://golang.org/issue/26492)
FROM gcr.io/distroless/base:nonroot
WORKDIR /codies
COPY --from=GO_BUILD /codies/codies ./codies
COPY --from=JS_BUILD /frontend/build ./frontend/build
ENTRYPOINT [ "/codies/codies", "--prod" ]
EXPOSE 5000
