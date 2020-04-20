import axios from "axios"
import bluebird from "bluebird"
import chalk from "chalk"
import {Message} from "discord.js"
import moment from "moment"
import path from "path"
import {Pool, QueryArrayConfig, QueryConfig, QueryResult} from "pg"
import querystring from "querystring"
import * as Redis from "redis"
import * as config from "../config.json"
import {Command} from "./Command"
import {Functions} from "./Functions"
import {Settings} from "./Settings"

const RedisAsync = bluebird.promisifyAll(Redis)
const redis = RedisAsync.createClient({
  url: process.env.REDIS_URL
}) as any
const pgPool = new Pool({
  connectionString: process.env.PG_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 2
})

const tableList = [
  "birthdays",
  "blocks",
  "channels",
  "emojis",
  "guild info",
  "guilds",
  "images",
  "logs",
  "points",
  "prefixes",
  "roles",
  "special channels",
  "special roles",
  "users",
  "warns",
  "welcome leaves",
  "captcha",
  "auto",
  "detection",
  "config"
]

export class SQLQuery {
  constructor(private readonly message: Message) {}

  // Run Query
  public static runQuery = async (query: QueryConfig | QueryArrayConfig, newData?: boolean): Promise<string[][]> => {
      const start = Date.now()
      let redisResult = null
      if (!newData) redisResult = await redis.getAsync(JSON.stringify(query)) as any
      if (redisResult) {
        // SQLQuery.logQuery(Object.values(query)[0], start, true)
        return (JSON.parse(redisResult))[0]
      } else {
        const pgClient = await pgPool.connect()
        try {
            const result: QueryResult<string[]> = await pgClient.query(query)
            // this.logQuery(Object.values(query)[0], start);
            await redis.setAsync(JSON.stringify(query), JSON.stringify(result.rows))
            return result.rows
          } catch (error) {
            console.log(error.stack)
            return [["Error"]]
          } finally {
            // @ts-ignore
            pgClient.release(true)
          }
      }
    }

  // Log Query
  public static logQuery = (text: any, start: number, blue?: boolean): void => {

      const duration = Date.now() - start
      const color = blue ? "cyanBright" : "magentaBright"
      const timestamp = `${moment().format("MM DD YYYY hh:mm:ss")} ->`

      const queryString = `${timestamp} Executed query ${text} in ${duration} ms`
      console.log(chalk`{${color} ${queryString}}`)
    }

  // Flush Redis DB
  public static flushDB = async (): Promise<void> => {
      await redis.flushdbAsync()
    }

  // Redis Set
  public redisSet = async (key: string, value: string | null, expiration?: number) => {
    if (value === null) value = "null"
    if (expiration) {
      await redis.setAsync(key, value, "EX", expiration)
    } else {
      await redis.setAsync(key, value)
    }
  }

  // Redis Get
  public redisGet = async (key: string) => {
    const result = await redis.getAsync(key) as any
    return result
  }

  // Fetch a row
  public fetchRow = async (table: string, update?: boolean): Promise<string[]> => {
    const query: QueryArrayConfig = {
      text: `SELECT * FROM "${table}" WHERE "guild id" = $1`,
      rowMode:"array",
      values: [this.message.guild?.id]
    }
    const result = update ? await SQLQuery.runQuery(query, true) : await SQLQuery.runQuery(query)
    return result[0]
}

  // Fetch commands
  public static fetchCommand = async (command: string, column: string): Promise<string[]> => {
    const query: QueryArrayConfig = {
      text: `SELECT "${column}" FROM commands WHERE command IN ($1)`,
      values: [command],
      rowMode: "array"
    }
    const result = await SQLQuery.runQuery(query, true)
    return result[0]
  }

  // Fetch aliases
  public fetchAliases = async (update?: boolean): Promise<string[]> => {
      const query: QueryArrayConfig = {
        text: `SELECT aliases FROM commands`,
        rowMode: "array"
      }
      const result = await SQLQuery.runQuery(query, true)
      return result[0]
  }

  // Fetch Prefix
  public static fetchPrefix = async (message: Message, update?: boolean): Promise<string> => {
    if (!message.guild?.id) return "=>"
    const query: QueryArrayConfig = {
        text: `SELECT prefix FROM prefixes WHERE "guild id" = $1`,
        rowMode: "array",
        values: [message.guild?.id]
    }
    const result = update ? await SQLQuery.runQuery(query, true) : await SQLQuery.runQuery(query)
    if (!result) {
        await SQLQuery.initGuild(message)
        return "=>"
      } else {
        return String(result[0])
      }
  }

  // Fetch a column
  public fetchColumn = async (table: string, column: string, key?: string | boolean, value?: string | boolean, update?: boolean): Promise<any> => {
    const query: QueryArrayConfig = key ? {
      text: `SELECT "${column}" FROM "${table}" WHERE "${key}" = $1`,
      rowMode: "array",
      values: [value]
    } : {
      text: `SELECT "${column}" FROM "${table}" WHERE "guild id" = $1`,
      rowMode: "array",
      values: [this.message.guild?.id]
    }
    const result = await SQLQuery.runQuery(query, true)
    const data = result?.[0]?.[0]
    if (data) {
      if (data === "[]" || data === "{}") return null
      return JSON.parse(JSON.stringify(data))
    }
    return null
  }

  /** Fetch Column Static */
  public static fetchColumn = async (table: string, column: string, key?: string | boolean, value?: string | boolean) => {
    const query: QueryArrayConfig = {
      text: `SELECT "${column}" FROM "${table}" WHERE "${key}" = $1`,
      rowMode: "array",
      values: [value]
    }
    const result = await SQLQuery.runQuery(query, true)
    const data = result?.[0]?.[0]
    if (data) {
      if (data === "[]" || data === "{}") return null
      return JSON.parse(JSON.stringify(data))
    }
    return null
  }

  /** Selects a column. */
  public static selectColumn = async (table: string, column: string, update?: boolean): Promise<any> => {
    const query: QueryArrayConfig = {
      text: `SELECT "${column}" FROM "${table}"`,
      rowMode: "array"
    }
    const result = update ? await SQLQuery.runQuery(query, true) : await SQLQuery.runQuery(query, true)
    return result.flat()
  }

  // Insert row into a table
  public static insertInto = async (table: string, column: string, value: any): Promise<void> => {
      const query: QueryConfig = {
        text: `INSERT INTO "${table}" ("${column}") VALUES ($1)`,
        values: [value]
      }
      await SQLQuery.runQuery(query, true)
  }

  // Insert command
  public static insertCommand = async (name: string, path: string, command: Command): Promise<void> => {
  const cmd = command.options
  const query: QueryConfig = {
      text: `INSERT INTO commands (command, aliases, path, cooldown, help, examples, "guild only", random, permission, "bot permission") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      values: [name, cmd.aliases, path, cmd.cooldown, cmd.help, cmd.examples, cmd.guildOnly, cmd.random, cmd.permission, cmd.botPermission]
    }
  await SQLQuery.runQuery(query, true)
  }

  // Update Prefix
  public static updatePrefix = async (message: Message, prefix: string): Promise<void> => {
  const query: QueryConfig = {
      text: `UPDATE "prefixes" SET "prefix" = $1 WHERE "guild id" = $2`,
      values: [prefix, message.guild?.id]
    }
  await SQLQuery.runQuery(query, true)
  SQLQuery.fetchPrefix(message, true)
  }

  // Update a row in a table
  public updateColumn = async (table: string, column: string, value: any, key?: string, keyVal?: string): Promise<void> => {
      let query: QueryConfig
      if (key) {
        query = {
          text: `UPDATE "${table}" SET "${column}" = $1 WHERE "${key}" = $2`,
          values: [value, keyVal]
        }
      } else {
        query = {
          text: `UPDATE "${table}" SET "${column}" = $1 WHERE "guild id" = $2`,
          values: [value, this.message.guild?.id]
        }
      }
      await SQLQuery.runQuery(query, true)
  }

  /** Update Column Static */
  public static updateColumn = async (table: string, column: string, value: any, key: string, keyVal: string): Promise<void> => {
    const query: QueryConfig = {
        text: `UPDATE "${table}" SET "${column}" = $1 WHERE "${key}" = $2`,
        values: [value, keyVal]
    }
    await SQLQuery.runQuery(query, true)
  }

  // Update Command
  public static updateCommand = async (name: string, path: string, command: Command): Promise<void> => {
  const cmd = command.options
  const query: QueryConfig = {
    text: `UPDATE commands SET aliases = $2, cooldown = $3, help = $4, examples = $5, "guild only" = $6, random = $7, permission = $8, "bot permission" = $9, path = $10 WHERE "command" = $1`,
    values: [name, cmd.aliases, cmd.cooldown, cmd.help, cmd.examples, cmd.guildOnly, cmd.random, cmd.permission, cmd.botPermission, path]
  }
  await SQLQuery.runQuery(query, true)
  }

  // Remove a guild from all tables
  public static deleteGuild = async (guildID: string): Promise<void> => {
      for (let i = 0; i < tableList.length; i++) {
        if (tableList[i] === "points") continue
        const query: QueryConfig = {
          text: `DELETE FROM "${tableList[i]}" WHERE "guild id" = $1`,
          values: [guildID]
        }
        await SQLQuery.runQuery(query, true)
      }
  }

  // Delete row
  public static deleteRow = async (table: string, column: string, value: any): Promise<void> => {
    const query: QueryConfig = {
      text: `DELETE FROM "${table}" WHERE "${column}" = $1`,
      values: [value]
    }
    await SQLQuery.runQuery(query, true)
  }

  /** Deletes a table. */
  public static purgeTable = async (table: string): Promise<void> => {
    if (table === "points") return
    const query: QueryConfig = {
      text: `DELETE FROM "${table}"`
    }
    await SQLQuery.runQuery(query, true)
  }

  // Order tables by guild member count
  public static orderTables = async (): Promise<void> => {
      for (let i = 0; i < tableList.length; i++) {
          const query: QueryConfig = {
            text: `SELECT members FROM "${tableList[i]}" ORDER BY
            CASE WHEN "guild id" = '578604087763795970' THEN 0 ELSE 1 END, members ASC`
          }
          await SQLQuery.runQuery(query, true)
      }
  }

  /** Init Guild */
  public static initGuild = async (message: Message, force?: boolean) => {
    const settings = new Settings(message)
    const query: QueryArrayConfig = {
          text: `SELECT "guild id" FROM guilds`,
          rowMode: "array"
    }
    const result = await SQLQuery.runQuery(query, true)
    const found = result.find((id: string[]) => String(id) === message.guild?.id) as any
    if (!found || force) {
          for (let i = 0; i < tableList.length; i++) {
            try {
              await SQLQuery.insertInto(tableList[i], "guild id", message.guild?.id)
            } catch {
              // Do nothing
            }
          }
          await settings.initAll()
          await SQLQuery.orderTables()
    }
    return
  }

  /** Gets all tables. */
  public static getTables = async () => {
    const query: QueryConfig = {
      text: `SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema = 'public' ORDER BY table_name`
    }
    const result = await SQLQuery.runQuery(query, true) as any
    return result.map((r: any) => r.table_name) as string[]
  }

  /** Deletes all rows from all tables. */
  public static purgeDB = async () => {
    for (let i = 0; i < tableList.length; i++) {
      if (tableList[i] === "points") continue
      await SQLQuery.purgeTable(tableList[i])
    }
    return
  }

  /** Sets foreign keys. */
  public static foreignKeys = async (table: string) => {
    const query: QueryConfig = {
      text: `ALTER TABLE "${table}" ADD FOREIGN KEY ("guild id") REFERENCES guilds ("guild id")`
    }
    await SQLQuery.runQuery(query, true)
  }

  /** Removes foreign keys. */
  public static dropForeignKeys = async (table: string) => {
    const query: QueryConfig = {
      text: `ALTER TABLE "${table}" DROP CONSTRAINT "${table}_guild id_fkey"`
    }
    await SQLQuery.runQuery(query, true)
  }

  /** Deletes duplicate records. */
  public static deleteDuplicates = async (table: string, key: string) => {
    const query: QueryConfig = {
      text: `DELETE FROM "${table}" T1 USING "${table}" T2
      WHERE T1.ctid < T2.ctid AND T1."${key}" = T2."${key}"`
    }
    await SQLQuery.runQuery(query, true)
  }

  /** Deletes user data on account deletion */
  public static deleteUser = async (id: string) => {
    await SQLQuery.deleteRow("misc", "user id", id).catch(() => null)
    await SQLQuery.deleteRow("oauth2", "user id", id).catch(() => null)
  }

  /** Revokes an oauth2 entry */
  public static revokeOuath2 = async (id: string) => {
    const token = await SQLQuery.fetchColumn("oauth2", "access token", "user id", id)
    if (!token) return
    const clientID = config.testing === "on" ? process.env.TEST_CLIENT_ID : process.env.CLIENT_ID
    const clientSecret = config.testing === "on" ? process.env.TEST_CLIENT_SECRET : process.env.CLIENT_SECRET
    const data = await axios.post(`https:// discordapp.com/api/oauth2/token/revoke`, querystring.stringify({
      client_id: clientID,
      client_secret: clientSecret,
      token
    })).then((r) => r.data)
    await SQLQuery.deleteRow("oauth2", "access token", token)
  }

  /** Inits an oauth2 entry */
  public static initOauth2 = async (code: string) => {
    const clientID = config.testing === "on" ? process.env.TEST_CLIENT_ID : process.env.CLIENT_ID
    const clientSecret = config.testing === "on" ? process.env.TEST_CLIENT_SECRET : process.env.CLIENT_SECRET
    const redirectURI = config.testing === "on" ? "http://localhost:5000" : "https://kisaragi-discord-bot.herokuapp.com/"
    const data = await axios.post(`https://discordapp.com/api/oauth2/token`, querystring.stringify({
      client_id: clientID,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectURI,
      scope: "identify,email,connections,guilds,guilds.join,gdm.join"
    })).then((r) => r.data)
    const accessToken = data.access_token
    const refreshToken = data.refresh_token
    const tokenType = data.token_type
    const info = await axios.get(`https://discordapp.com/api/users/@me`, {
      headers: {authorization: `${tokenType} ${accessToken}`}
    }).then((r) => r.data)
    const connections = await axios.get(`https://discordapp.com/api/users/@me/connections`, {
      headers: {authorization: `${tokenType} ${accessToken}`}
    }).then((r) => r.data)
    const guilds = await axios.get(`https://discordapp.com/api/users/@me/guilds`, {
      headers: {authorization: `${tokenType} ${accessToken}`}
    }).then((r) => r.data)
    const tag = `${info.username}#${info.discriminator}`
    try {
      await SQLQuery.insertInto("oauth2", "user id", info.id)
    } finally {
      await SQLQuery.updateColumn("oauth2", "access token", accessToken, "user id", info.id)
      await SQLQuery.updateColumn("oauth2", "refresh token", refreshToken, "user id", info.id)
      await SQLQuery.updateColumn("oauth2", "email", info.email, "user id", info.id)
      await SQLQuery.updateColumn("oauth2", "user tag", tag, "user id", info.id)
      await SQLQuery.updateColumn("oauth2", "connections", connections, "user id", info.id)
      await SQLQuery.updateColumn("oauth2", "guilds", guilds, "user id", info.id)
    }
  }

  /** Revokes twitter oauth */
  public static revokeTwitterOauth = async (userID: string) => {
    await SQLQuery.updateColumn("oauth2", "twitter token", null, "user id", userID)
    await SQLQuery.updateColumn("oauth2", "twitter secret", null, "user id", userID)
  }

  /** Inits twitter oauth */
  public static twitterOauth = async (token: string, verifier: string) => {
    const data = await axios.post(`https://api.twitter.com/oauth/access_token?oauth_token=${token}&oauth_verifier=${verifier}`).then((r) => querystring.parse(r.data))
    const twitterToken = data.oauth_token
    const twitterSecret = data.oauth_token_secret
    const username = data.screen_name
    const userID = data.user_id
    const keys = await SQLQuery.selectColumn("oauth2", "user id")
    const connections = await SQLQuery.selectColumn("oauth2", "connections")
    let index = -1
    twit:
    for (let i = 0; i < connections.length; i++) {
      for (let j = 0; j < connections[i].length; j++) {
        const curr = JSON.parse(connections[i][j])
        if (curr.type === "twitter" && curr.id === userID) {
          index = i
          break twit
        }
      }
    }
    if (index === -1) return Promise.reject("Twitter id not found")
    const discordID = keys[index]
    await SQLQuery.updateColumn("oauth2", "twitter token", twitterToken, "user id", discordID)
    await SQLQuery.updateColumn("oauth2", "twitter secret", twitterSecret, "user id", discordID)
    await SQLQuery.updateColumn("oauth2", "screen name", username, "user id", discordID)
    await SQLQuery.updateColumn("oauth2", "twitter id", userID, "user id", discordID)
  }
}
