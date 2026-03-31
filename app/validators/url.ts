import vine from '@vinejs/vine'
import { urlRequestSchema } from '#schemas/url'

export const urlQueryValidator = vine.create(urlRequestSchema)
