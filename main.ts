import { htmlToMarkdown, Plugin, request } from 'obsidian'
import { parseFeed } from '@rowanmanning/feed-parser';

const FOLDER = "RSS"
const REFRESHTIMER = 60

export default class RSSNotes extends Plugin {
	async onload(): Promise<void> {
		this.addCommand({
			id: 'update-feeds',
			name: 'Update all feeds',
			callback: () => { this.reloadFeeds() },
		});

		setTimeout(() => { this.reloadFeeds() }, REFRESHTIMER * 60 * 1000)

		this.reloadFeeds()
	}

	onunload(): void {

	}

	async reloadFeeds() {
		for (let feed of await this.getAllFeeds()) {
			this.getSingleFeed(feed.url, feed.path)
		}
	}

	async getSingleFeed(url: string, path: string) {
		const response = await request({ url: url });
		const feed = parseFeed(response);

		const feedPath = `${FOLDER}/${this.escapeForPath(feed.title)}`
		if (this.app.vault.getFolderByPath(feedPath) === null) {
			this.app.vault.createFolder(feedPath)
		}

		//console.log(feed)
		for (let item of feed.items) {
			//console.log(item)

			let filePath = `${feedPath}/${this.escapeForPath(item.title)}_${item.published?.getTime()}.md`
			if (this.app.vault.getFileByPath(filePath) === null) {
				//Building Note text
				let noteText = `---\n`

				//Adding title
				noteText += `title: ${item.title?.replaceAll(":", " -")}\n`

				//Adding Autors
				noteText += `authors:\n`
				for (let author of item.authors) {
					noteText += ` - ${author.name}\n`
				}

				//Adding cathegories
				noteText += `cathegories:\n`
				for (let cathegory of item.categories) {
					noteText += ` - ${cathegory.label}\n`
				}

				//Adding description
				if (typeof item.description === "string") {
					noteText += `desciption: "${htmlToMarkdown(item.description).replaceAll("\n", "<br>").replaceAll(`"`, "'")}"\n`
				}
				else { noteText += `description: \n` }

				//Adding pubish time
				noteText += `published: ${item.published?.toISOString()}\n`

				//Adding update time
				noteText += `updated: ${item.updated?.toISOString()}\n`

				//Adding id (link)
				noteText += `id: ${item.id}\n`

				//Adding cover image
				if (item.image != null) {
					noteText += `cover: ${item.image.url}\n`
				}
				else if (item.mediaImages.length > 0) {
					noteText += `cover: ${item.mediaImages[0].url}\n`
				}
				else if (feed.image != null) {
					noteText += `cover: ${feed.image.url}\n`
				}

				noteText += `---\n`

				//Adding text
				if (typeof item.content === "string") {
					noteText += htmlToMarkdown(item.content)
				}

				//Writing to Vault
				this.app.vault.create(filePath, noteText)
			}
		}

		let f = this.app.vault.getFileByPath(path)
		if (f != null) {
			let feedFileText = `---
description: ${feed.description}
url: ${feed.self}
updated: ${feed.updated?.toISOString()}
lastChecked: ${new Date().toISOString()}
---
# Feed
\`\`\`base
filters:
  and:
    - file.inFolder("RSS/${feed.title}")
formulas:
  Untitled: ""
views:
  - type: cards
    name: Feed
    order:
      - file.name
      - authors
      - published
      - desciption
    sort:
      - property: published
        direction: DESC
    cardSize: 400
    image: note.cover
    imageAspectRatio: 0.5

\`\`\`
`
			this.app.vault.modify(f, feedFileText)
			this.app.vault.rename(f, `${feedPath}.md`)
		}
	}

	escapeForPath(text: string | null) {
		if (typeof text === "string") {
			return text.replaceAll(":", " -").replaceAll("/", "-").replaceAll("\\", "-")
		}
		else { return "" }
	}

	async getAllFeeds() {
		let files = this.app.vault.getMarkdownFiles()

		let feedList = []
		for (let f of files) {
			if (f.parent?.name == FOLDER && f.path.startsWith(FOLDER)) {
				let text = await this.app.vault.read(f)
				let match = text.match(`---
(.*
)*.*url: (.*)
(.*
)*---`)
				if (match != null) {
					feedList.push({ url: match[2], path: f.path })
				}
			}
		}

		return feedList
	}
}