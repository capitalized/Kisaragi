import {Message} from "discord.js"
import {Command} from "../../structures/Command"
import {Embeds} from "./../../structures/Embeds"
import {Functions} from "./../../structures/Functions"
import {Kisaragi} from "./../../structures/Kisaragi"

const animeQuotes = require("animequotes")

export default class AnimeQuote extends Command {
    constructor(discord: Kisaragi, message: Message) {
        super(discord, message, {
            description: "Posts a random anime quote.",
            aliases: [],
            cooldown: 3
        })
    }

    public run = async (args: string[]) => {
        const discord = this.discord
        const message = this.message
        const embeds = new Embeds(discord, message)

        const animeQuoteEmbed = embeds.createEmbed()

        if (!args[1]) {
            const quote = animeQuotes.randomQuote()
            animeQuoteEmbed
            .setAuthor("animequotes", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnI2SHuhdw8zEPc3xG0gfJyT4y2f8n4b_UKZCdjLQxnoI-2JEP")
            .setTitle(`**Anime Quote** ${discord.getEmoji("raphi")}`)
            .setDescription(
            `${discord.getEmoji("star")}_Anime:_ **${quote.anime}**\n` +
            `${discord.getEmoji("star")}_Character:_ **${quote.name}**\n` +
            `${discord.getEmoji("star")}_Quote:_ ${quote.quote}`
            )
            message.channel.send(animeQuoteEmbed)
            return
        } else {
            const query = Functions.combineArgs(args, 1)
            const quote = animeQuotes.getQuotesByAnime(query)
            if (quote.quote === undefined) {
                    const aniQuote = animeQuotes.getQuotesByCharacter(query)
                    if (aniQuote.quote === undefined) {
                        animeQuoteEmbed
                        .setTitle(`**Anime Quote** ${discord.getEmoji("raphi")}`)
                        .setDescription("Could not find a quote!")
                        message.channel.send(animeQuoteEmbed)
                        return
                    }
                    animeQuoteEmbed
                    .setAuthor("animequotes", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnI2SHuhdw8zEPc3xG0gfJyT4y2f8n4b_UKZCdjLQxnoI-2JEP")
                    .setTitle(`**Anime Quote** ${discord.getEmoji("raphi")}`)
                    .setDescription(
                    `${discord.getEmoji("star")}_Anime:_ **${quote.anime}**\n` +
                    `${discord.getEmoji("star")}_Character:_ **${quote.name}**\n` +
                    `${discord.getEmoji("star")}_Quote:_ ${quote.quote}`
                    )
                    message.channel.send(animeQuoteEmbed)
                    return
                }
            animeQuoteEmbed
                .setAuthor("animequotes", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnI2SHuhdw8zEPc3xG0gfJyT4y2f8n4b_UKZCdjLQxnoI-2JEP")
                .setTitle(`**Anime Quote** ${discord.getEmoji("raphi")}`)
                .setDescription(
                `${discord.getEmoji("star")}_Anime:_ **${quote.anime}**\n` +
                `${discord.getEmoji("star")}_Character:_ **${quote.name}**\n` +
                `${discord.getEmoji("star")}_Quote:_ ${quote.quote}`
                )
            message.channel.send(animeQuoteEmbed)
            }
    }
}
