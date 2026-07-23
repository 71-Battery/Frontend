import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const outputDirectory = resolve(projectRoot, 'dist')

if (outputDirectory !== resolve(projectRoot, 'dist')) {
  throw new Error('Unexpected build output directory')
}

await rm(outputDirectory, { recursive: true, force: true })
