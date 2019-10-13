import {Message, MessageEmbed} from "discord.js"
import GoogleImages from "google-images"
import {Command} from "../../structures/Command"
import {Embeds} from "../../structures/Embeds"
import {Functions} from "./../../structures/Functions"
import {Kisaragi} from "./../../structures/Kisaragi"

export default class GoogleImageCommand extends Command {
    constructor(discord: Kisaragi, message: Message) {
        super(discord, message, {
            description: "Searches google images.",
            aliases: [],
            cooldown: 3
        })
    }

    public run = async (args: string[]) => {
        const discord = this.discord
        const message = this.message

        const embeds = new Embeds(discord, message)
        const query = Functions.combineArgs(args, 1)

        const images = new GoogleImages(process.env.GOOGLE_IMAGES_ID!, process.env.GOOGLE_API_KEY!)

        const result = await images.search(query)
        const imagesArray: MessageEmbed[] = []
        for (let i = 0; i < result.length; i++) {
            const imageEmbed = embeds.createEmbed()
            const size = Math.floor(result[i].size/1024)
            imageEmbed
            .setAuthor("google images", "https://cdn4.iconfinder.com/data/icons/new-google-logo-2015/400/new-google-favicon-512.png")
            .setURL(result[i].url)
            .setTitle(`**Image Search** ${discord.getEmoji("raphi")}`)
            .setDescription(
                `${discord.getEmoji("star")}_Website:_ ${result[i].url}\n` +
                `${discord.getEmoji("star")}_Width:_ ${result[i].width} _Height:_ ${result[i].height}\n` +
                `${discord.getEmoji("star")}_Filesize:_ ${size}KB\n` +
                `${discord.getEmoji("star")}_Description:_ ${result[i].type}`
            )
            .setImage(result[i].url)
            imagesArray.push(imageEmbed)
        }
        embeds.createReactionEmbed(imagesArray)
    }
}
