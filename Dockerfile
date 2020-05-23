FROM node:14 AS JS_BUILD
WORKDIR /frontend
COPY ./frontend/package.json ./frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY ./frontend ./
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
ENTRYPOINT [ "/codies/codies" ]
EXPOSE 5000
