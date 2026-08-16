/**
 * サンプル台本(taro/hana)。以前は sample.script.txt を `?raw` importして
 * いたが、Nitro(サーバー)側のビルドでは `?raw` サフィックスが解決できず
 * ビルドエラーになったため、文字列定数として直接持つ形にした。
 */
export const sampleScriptText = `# サンプルシナリオ
# 「@char id 表示名 色」でキャラクターを登録します

@char taro 太郎 #4fc3f7
@char hana 花子 #f48fb1

夏の日差しが差し込む教室。

taro: おはよう、花子。
hana: おはよう、太郎くん。今日もいい天気だね。

taro: 放課後、どこか行かない?

?
> 公園に誘う -> park
> 図書館に誘う -> library

*park
taro: じゃあ、公園に行こう。
hana: うん、楽しみ!
-> ending

*library
taro: じゃあ、図書館に行こう。
hana: 静かに勉強できそうだね。
-> ending

*ending
放課後、二人は連れ立って歩いていった。
`
