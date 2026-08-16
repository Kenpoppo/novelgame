import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudProjectRepository, GameSummary } from '../../application/ports/cloudProjectRepository'
import type { Project } from '#shared/domain/project/types'

interface ProjectRow {
  id: string
  title: string
  updated_at: string
}

export function createSupabaseCloudProjectRepository(client: SupabaseClient): CloudProjectRepository {
  function toSummary(row: ProjectRow): GameSummary {
    return { id: row.id, title: row.title, updatedAt: row.updated_at }
  }

  return {
    async save(ownerId, project, id) {
      if (id) {
        const { error } = await client
          .from('projects')
          .update({ title: project.title, content: project })
          .eq('id', id)
          .eq('owner_id', ownerId)
        if (error) throw error
        return id
      }

      const { data, error } = await client
        .from('projects')
        .insert({ owner_id: ownerId, title: project.title, content: project, published: false })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },

    async listMine(ownerId) {
      const { data, error } = await client
        .from('projects')
        .select('id,title,updated_at')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as ProjectRow[]).map(toSummary)
    },

    async listPublished() {
      const { data, error } = await client
        .from('projects')
        .select('id,title,updated_at')
        .eq('published', true)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as ProjectRow[]).map(toSummary)
    },

    async loadForOwner(ownerId, id) {
      const { data, error } = await client
        .from('projects')
        .select('content')
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle()
      if (error) throw error
      return (data?.content as Project | undefined) ?? null
    },

    async loadPublished(id) {
      const { data, error } = await client.from('projects').select('content').eq('id', id).eq('published', true).maybeSingle()
      if (error) throw error
      return (data?.content as Project | undefined) ?? null
    },

    async setPublished(ownerId, id, published) {
      const { error } = await client.from('projects').update({ published }).eq('id', id).eq('owner_id', ownerId)
      if (error) throw error
    },
  }
}
