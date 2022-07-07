const core = require('@actions/core')
const fs = require('fs')
const { Afdian } = require('afdian')

const userId = core.getInput('user-id') || process.env.AFDIAN_USER_ID
const token = core.getInput('token') || process.env.AFDIAN_TOKEN
const mdPath = core.getMultilineInput('markdown', { required: false }) || ['README.md']

const client = new Afdian({
    userId,
    token,
})

async function main() {
    const result = await client.querySponsor(1)
    const list = result.data.list.map(l => ({ ...l, sum: Number(l.all_sum_amount) }))

    list.sort((a, b) => -a.sum + b.sum)

    function knn() {
        const pivot = [list[0].sum, list[Math.floor(list.length / 2)].sum, list[list.length - 1].sum]
        let iteration = 0
        const groups = new Array(list.length)

        while (iteration < 1000) {
            for (let i = 0; i < list.length; i++) {
                const distance = [
                    Math.abs(list[i].sum - pivot[0]),
                    Math.abs(list[i].sum - pivot[1]),
                    Math.abs(list[i].sum - pivot[2]),
                ]
                const minDistance = Math.min(...distance)
                const group = distance.indexOf(minDistance)
                groups[i] = group
            }
            const groupsSum = [0, 0, 0]
            const groupsCount = [0, 0, 0]
            for (let i = 0; i < list.length; i++) {
                const group = groups[i]
                groupsSum[group] += list[i].sum
                groupsCount[group]++
            }
            const newPivot0 = groupsCount[0] !== 0 ? groupsSum[0] / groupsCount[0] : pivot[0]
            const newPivot1 = groupsCount[1] !== 0 ? groupsSum[1] / groupsCount[1] : pivot[1]
            const newPivot2 = groupsCount[2] !== 0 ? groupsSum[2] / groupsCount[2] : pivot[2]

            if (pivot[0] === newPivot0)
                if (pivot[1] === newPivot1)
                    if (pivot[2] === newPivot2) {
                        break
                    }

            pivot[0] = newPivot0
            pivot[1] = newPivot1
            pivot[2] = newPivot2
            iteration++
        }

        return groups
    }

    const sizes = knn()

    function getSize(i) {
        const s = sizes[i]
        if (s === 0) return 100
        if (s === 1) return 70
        return 50
    }

    function generateContent() {
        let content = '<div style="display: flex; align-items: center; justify-items:center; gap: 0.2em; flex-wrap: wrap;">\n'
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            const s = getSize(i)
            content += `<a title="${p.user.name}: ￥${p.all_sum_amount}" href="https://afdian.net/u/${p.user.user_id}"> <img width="${s}" height="${s}" style="border-radius: 100%" src="${p.user.avatar}"> </a>\n`
        }
        content += '</div>'

        return content
    }

    for (const p of mdPath) {
        try {
            const md = fs.readFileSync(p, 'utf-8')
            const start = md.indexOf('<!-- afdian-start -->')
            const end = md.indexOf('<!-- afdian-end -->')
            const transformed = md.slice(0, start + '<!-- afdian-start -->'.length)
                + '\n'
                + generateContent()
                + '\n'
                + md.slice(end)
            fs.writeFileSync(p, transformed)
        } catch (e) { console.error(e) }
    }
}

main()
