package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/anacrolix/torrent"
)

type TorrentFile struct {
	Path   string `json:"path"`
	Length int64  `json:"length"`
}

func listFilesFromInfohash(infohash string) ([]TorrentFile, error) {
	clientConfig := torrent.NewDefaultClientConfig()
	clientConfig.Seed = false
	clientConfig.NoUpload = true

	client, err := torrent.NewClient(clientConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create torrent client: %w", err)
	}
	defer client.Close()

	torrentHandle, err := client.AddMagnet("magnet:?xt=urn:btih:" + infohash)
	if err != nil {
		return nil, fmt.Errorf("failed to add magnet link: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	select {
	case <-torrentHandle.GotInfo():
		// Metadata received successfully
	case <-ctx.Done():
		return nil, fmt.Errorf("timed out waiting for torrent metadata")
	}

	var files []TorrentFile
	for _, file := range torrentHandle.Files() {
		files = append(files, TorrentFile{
			Path:   file.Path(),
			Length: file.Length(),
		})
	}

	return files, nil
}
func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: program <infohash>")
	}

	infohash := os.Args[1]
	files, err := listFilesFromInfohash(infohash)
	if err != nil {
		log.Fatalf("error listing torrent files: %v", err)
	}

	if err := json.NewEncoder(os.Stdout).Encode(files); err != nil {
		log.Fatalf("error encoding json: %v", err)
	}
}
