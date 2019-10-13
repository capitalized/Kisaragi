import {Message} from "discord.js"
import PixivApiClient from "pixiv-app-api"
import {Command} from "../../structures/Command"
import {Embeds} from "./../../structures/Embeds"
import {Functions} from "./../../structures/Functions"
import {Images} from "./../../structures/Images"
import {Kisaragi} from "./../../structures/Kisaragi"
import {Permission} from "./../../structures/Permission"
import {PixivApi} from "./../../structures/PixivApi"

const Ugoira = require("node-ugoira")
const pixivImg = require("pixiv-img")

export default class UgoiraCommand extends Command {
    constructor(discord: Kisaragi, message: Message) {
        super(discord, message, {
            description: "Posts a pixiv ugoira.",
            aliases: [],
            cooldown: 3
        })
    }

    public run = async (args: string[]) => {
        const discord = this.discord
        const message = this.message
        const images = new Images(discord, message)
        const embeds = new Embeds(discord, message)
        const pixivApi = new PixivApi(discord, message)
        const perms = new Permission(discord, message)
        const fs = require("fs")
        const pixiv = new PixivApiClient(undefined, undefined, {camelcaseKeys: true})
        const input = (args[1].toLowerCase() === "r18" || args[1].toLowerCase() === "en") ?
        ((args[2] === "en") ? Functions.combineArgs(args, 3) : Functions.combineArgs(args, 2)) :
        Functions.combineArgs(args, 1)
        const msg1 = await message.channel.send(`**Fetching Ugoira** ${discord.getEmoji("gabCircle")}`) as Message
        let pixivID
        if (input.match(/\d+/g) !== null) {
            pixivID = input.match(/\d+/g)!.join("")
        } else {
            if (args[1].toLowerCase() === "r18") {
                if (!perms.checkNSFW()) return
                if (args[2].toLowerCase() === "en") {
                    const image = await pixivApi.getPixivImage(input, true, true, true, true)
                    try {
                            pixivID = image.id
                        } catch (err) {
                            if (err) pixivApi.pixivErrorEmbed()
                        }
                } else {
                    const image = await pixivApi.getPixivImage(input, true, false, true, true)
                    try {
                            pixivID = image.id
                        } catch (err) {
                            if (err) pixivApi.pixivErrorEmbed()
                        }
                }
            } else if (args[1].toLowerCase() === "en") {
                const image = await pixivApi.getPixivImage(input, false, true, true, true)
                try {
                        pixivID = image.id
                    } catch (err) {
                        if (err) pixivApi.pixivErrorEmbed()
                    }
            } else {
                const image = await pixivApi.getPixivImage(input, false, false, true, true)
                try {
                        pixivID = image.id
                    } catch (err) {
                        if (err) pixivApi.pixivErrorEmbed()
                    }
            }
        }

        await pixiv.login()
        const details = await pixiv.illustDetail(pixivID as number)
        const ugoiraInfo = await pixiv.ugoiraMetaData(pixivID as number)
        const fileNames: string[] = []
        const frameDelays: number[] = []
        const frameNames: string[] = []
        for (let i = 0; i < ugoiraInfo.ugoiraMetadata.frames.length; i++) {
            frameDelays.push(ugoiraInfo.ugoiraMetadata.frames[i].delay)
            fileNames.push(ugoiraInfo.ugoiraMetadata.frames[i].file)
        }
        for (let i = 0; i < fileNames.length; i++) {
            frameNames.push(fileNames[i].slice(0, -4))
        }

        const ugoira = new Ugoira(pixivID)
        await ugoira.initUgoira()

        const file = fs.createWriteStream(`ugoira/${pixivID}/${pixivID}.gif`, (error: Error) => console.log(error))

        msg1.delete({timeout: 1000})
        const msg2 = await message.channel.send(`**Converting Ugoira to Gif. This might take awhile** ${discord.getEmoji("gabCircle")}`) as Message
        await images.encodeGif(fileNames, `ugoira/${pixivID}/`, file)
        msg2.delete({timeout: 1000})

        const msg3 = await message.channel.send(`**Compressing Gif** ${discord.getEmoji("gabCircle")}`) as Message
        await images.compressGif([`ugoira/${pixivID}/${pixivID}.gif`])
        msg3.delete({timeout: 1000})

        const ugoiraEmbed = embeds.createEmbed()
        const {Attachment} = require("discord.js")
        const outGif = new Attachment(`../assets/gifs/${pixivID}.gif`)
        const comments = await pixiv.illustComments(pixivID as number)
        const cleanText = details.caption.replace(/<\/?[^>]+(>|$)/g, "")
        const authorUrl = await pixivImg(details.user.profileImageUrls.medium)
        const authorAttachment = new Attachment(authorUrl)
        const commentArray: string[] = []
        for (let i = 0; i <= 5; i++) {
                    if (!comments.comments[i]) break
                    commentArray.push(comments.comments[i].comment)
                }
        ugoiraEmbed
            .setTitle(`**Pixiv Ugoira** ${discord.getEmoji("kannaSip")}`)
            .setURL(`https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${pixivID}`)
            .setDescription(
                `${discord.getEmoji("star")}_Title:_ **${details.title}**\n` +
                `${discord.getEmoji("star")}_Artist:_ **${details.user.name}**\n` +
                `${discord.getEmoji("star")}_Creation Date:_ **${Functions.formatDate(new Date(details.createDate))}**\n` +
                `${discord.getEmoji("star")}_Views:_ **${details.totalView}**\n` +
                `${discord.getEmoji("star")}_Bookmarks:_ **${details.totalBookmarks}**\n` +
                `${discord.getEmoji("star")}_Description:_ ${cleanText ? cleanText : "None"}\n` +
                `${discord.getEmoji("star")}_Comments:_ ${commentArray.join() ? commentArray.join() : "None"}\n`
                )
            .attachFiles([outGif.file, authorAttachment])
            .setThumbnail(`attachment://${authorAttachment.file}`)
            .setImage(`attachment://${pixivID}.gif`)
        message.channel.send(ugoiraEmbed)
    }
}
