NAME    := OhMyNewTabPage
VERSION := $(shell jq -r '.version' manifest.json)
DIST    := $(NAME)_v$(VERSION)

.PHONY: build clean release

build:
	npm run build

clean:
	rm -rf release/ $(DIST).zip

release: clean build
	mkdir -p release/icons
	cp newtab.html newtab.css LICENSE manifest.json release/
	cp temp_output.js temp_output.js.map release/
	cp icons/* release/icons/
	cd release && zip -r ../$(DIST).zip .

zip: release
