import {Message} from "discord.js"
import {Command} from "../../structures/Command"
import {Embeds} from "./../../structures/Embeds"
import {Functions} from "./../../structures/Functions"
import {Kisaragi} from "./../../structures/Kisaragi"

const Kuroshiro = require("kuroshiro")
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji")

export default class Katakana extends Command {
    constructor(discord: Kisaragi, message: Message) {
        super(discord, message, {
            description: "Converts romaji to katakana.",
            aliases: [],
            cooldown: 3
        })
    }

    public run = async (args: string[]) => {
        const discord = this.discord
        const message = this.message
        const embeds = new Embeds(discord, message)
        const kuroshiro = new Kuroshiro()
        await kuroshiro.init(new KuromojiAnalyzer())

        const input = Functions.combineArgs(args, 1)
        const result = await kuroshiro.convert(input, {mode: "spaced", to: "katakana"})
        const cleanResult = result.replace(/<\/?[^>]+(>|$)/g, "")

        const katakanaEmbed = embeds.createEmbed()
        katakanaEmbed
        .setAuthor("kuroshiro", "https://kuroshiro.org/kuroshiro.png")
        .setTitle(`**Katakana Conversion** ${discord.getEmoji("kannaSip")}`)
        .setDescription(`${discord.getEmoji("star")}${cleanResult}`)
        message.channel.send(katakanaEmbed)
    }
}
