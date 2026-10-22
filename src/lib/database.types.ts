
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity": {
                  Row: {
                    "action": string,"actor_id": string | null,"brand_id": string,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"label": string,"meta": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"brand_id": string,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"label"?: string,"meta"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"brand_id"?: string,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"label"?: string,"meta"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"asset_versions": {
                  Row: {
                    "asset_id": string,"brand_id": string,"created_at": string,"created_by": string | null,"file_name": string,"file_path": string,"height": number | null,"id": string,"mime_type": string,"note": string,"size_bytes": number,"thumb_path": string | null,"version": number,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"brand_id": string,"created_at"?: string,"created_by"?: string | null,"file_name": string,"file_path": string,"height"?: number | null,"id"?: string,"mime_type": string,"note"?: string,"size_bytes"?: number,"thumb_path"?: string | null,"version": number,"width"?: number | null
                  }
                  Update: {
                    "asset_id"?: string,"brand_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_name"?: string,"file_path"?: string,"height"?: number | null,"id"?: string,"mime_type"?: string,"note"?: string,"size_bytes"?: number,"thumb_path"?: string | null,"version"?: number,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "asset_versions_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_versions_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asset_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assets": {
                  Row: {
                    "brand_id": string,"copyright": string,"created_at": string,"created_by": string | null,"description": string,"downloadable": boolean,"expires_at": string | null,"ext": string,"file_name": string,"file_path": string,"height": number | null,"id": string,"library_id": string,"license_note": string,"mime_type": string,"size_bytes": number,"tags": (string)[],"thumb_path": string | null,"title": string,"updated_at": string,"version": number,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"copyright"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"downloadable"?: boolean,"expires_at"?: string | null,"ext"?: string,"file_name": string,"file_path": string,"height"?: number | null,"id"?: string,"library_id": string,"license_note"?: string,"mime_type"?: string,"size_bytes"?: number,"tags"?: (string)[],"thumb_path"?: string | null,"title": string,"updated_at"?: string,"version"?: number,"width"?: number | null
                  }
                  Update: {
                    "brand_id"?: string,"copyright"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"downloadable"?: boolean,"expires_at"?: string | null,"ext"?: string,"file_name"?: string,"file_path"?: string,"height"?: number | null,"id"?: string,"library_id"?: string,"license_note"?: string,"mime_type"?: string,"size_bytes"?: number,"tags"?: (string)[],"thumb_path"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "brand_id": string,"content": NonNullable<Json>,"created_at": string,"id": string,"page_id": string,"sort": number,"type": string,"updated_at": string,"updated_by": string | null,"width": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"page_id": string,"sort"?: number,"type": string,"updated_at"?: string,"updated_by"?: string | null,"width"?: string
                  }
                  Update: {
                    "brand_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"page_id"?: string,"sort"?: number,"type"?: string,"updated_at"?: string,"updated_by"?: string | null,"width"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "guideline_pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brand_members": {
                  Row: {
                    "brand_id": string,"created_at": string,"role": Database["public"]['Enums']["brand_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"role"?: Database["public"]['Enums']["brand_role"],"user_id": string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["brand_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_members_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brand_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"created_by": string | null,"description": string,"home": NonNullable<Json>,"id": string,"is_public": boolean,"logo_path": string | null,"name": string,"org_type": string,"public_downloads": boolean,"public_until": string | null,"slug": string,"tagline": string,"theme": NonNullable<Json>,"updated_at": string,"visibility": Database["public"]['Enums']["brand_visibility"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"home"?: NonNullable<Json>,"id"?: string,"is_public"?: boolean,"logo_path"?: string | null,"name": string,"org_type"?: string,"public_downloads"?: boolean,"public_until"?: string | null,"slug": string,"tagline"?: string,"theme"?: NonNullable<Json>,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["brand_visibility"],"workspace_id": string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"home"?: NonNullable<Json>,"id"?: string,"is_public"?: boolean,"logo_path"?: string | null,"name"?: string,"org_type"?: string,"public_downloads"?: boolean,"public_until"?: string | null,"slug"?: string,"tagline"?: string,"theme"?: NonNullable<Json>,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["brand_visibility"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brands_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brands_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_assets": {
                  Row: {
                    "asset_id": string,"brand_id": string,"collection_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"brand_id": string,"collection_id": string,"sort"?: number
                  }
                  Update: {
                    "asset_id"?: string,"brand_id"?: string,"collection_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_assets_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_assets_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_assets_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    }
                  ]
                },"collections": {
                  Row: {
                    "brand_id": string,"created_at": string,"description": string,"id": string,"library_id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"description"?: string,"id"?: string,"library_id": string,"name": string,"sort"?: number
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"library_id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "collections_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collections_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"color_palettes": {
                  Row: {
                    "brand_id": string,"created_at": string,"description": string,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"description"?: string,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "color_palettes_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"colors": {
                  Row: {
                    "brand_id": string,"cmyk": string,"created_at": string,"description": string,"hex": string,"hks": string,"id": string,"name": string,"ncs": string,"palette_id": string,"pantone": string,"ral": string,"sort": number,"token": string,"usage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"cmyk"?: string,"created_at"?: string,"description"?: string,"hex": string,"hks"?: string,"id"?: string,"name": string,"ncs"?: string,"palette_id": string,"pantone"?: string,"ral"?: string,"sort"?: number,"token"?: string,"usage"?: string
                  }
                  Update: {
                    "brand_id"?: string,"cmyk"?: string,"created_at"?: string,"description"?: string,"hex"?: string,"hks"?: string,"id"?: string,"name"?: string,"ncs"?: string,"palette_id"?: string,"pantone"?: string,"ral"?: string,"sort"?: number,"token"?: string,"usage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "colors_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "colors_palette_id_fkey"
      columns: ["palette_id"]
isOneToOne: false
      referencedRelation: "color_palettes"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "asset_id": string | null,"author_id": string | null,"block_id": string | null,"body": string,"brand_id": string,"created_at": string,"id": string,"page_id": string | null,"parent_id": string | null,"pos_x": number | null,"pos_y": number | null,"resolved": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id"?: string | null,"author_id"?: string | null,"block_id"?: string | null,"body": string,"brand_id": string,"created_at"?: string,"id"?: string,"page_id"?: string | null,"parent_id"?: string | null,"pos_x"?: number | null,"pos_y"?: number | null,"resolved"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string | null,"author_id"?: string | null,"block_id"?: string | null,"body"?: string,"brand_id"?: string,"created_at"?: string,"id"?: string,"page_id"?: string | null,"parent_id"?: string | null,"pos_x"?: number | null,"pos_y"?: number | null,"resolved"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_block_id_fkey"
      columns: ["block_id"]
isOneToOne: false
      referencedRelation: "blocks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "guideline_pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"fonts": {
                  Row: {
                    "brand_id": string,"created_at": string,"description": string,"fallback": string,"family": string,"files": NonNullable<Json>,"id": string,"license": string,"role": string,"sort": number,"source": string,"weights": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"description"?: string,"fallback"?: string,"family": string,"files"?: NonNullable<Json>,"id"?: string,"license"?: string,"role"?: string,"sort"?: number,"source"?: string,"weights"?: (number)[]
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"description"?: string,"fallback"?: string,"family"?: string,"files"?: NonNullable<Json>,"id"?: string,"license"?: string,"role"?: string,"sort"?: number,"source"?: string,"weights"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fonts_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"guideline_pages": {
                  Row: {
                    "brand_id": string,"created_at": string,"guideline_id": string,"id": string,"intro": string,"is_published": boolean,"kind": Database["public"]['Enums']["page_kind"],"parent_id": string | null,"slug": string,"sort": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"guideline_id": string,"id"?: string,"intro"?: string,"is_published"?: boolean,"kind"?: Database["public"]['Enums']["page_kind"],"parent_id"?: string | null,"slug": string,"sort"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"guideline_id"?: string,"id"?: string,"intro"?: string,"is_published"?: boolean,"kind"?: Database["public"]['Enums']["page_kind"],"parent_id"?: string | null,"slug"?: string,"sort"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guideline_pages_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guideline_pages_guideline_id_fkey"
      columns: ["guideline_id"]
isOneToOne: false
      referencedRelation: "guidelines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guideline_pages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "guideline_pages"
      referencedColumns: ["id"]
    }
                  ]
                },"guidelines": {
                  Row: {
                    "brand_id": string,"cover_path": string | null,"created_at": string,"description": string,"icon": string,"id": string,"is_published": boolean,"slug": string,"sort": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"cover_path"?: string | null,"created_at"?: string,"description"?: string,"icon"?: string,"id"?: string,"is_published"?: boolean,"slug": string,"sort"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string,"cover_path"?: string | null,"created_at"?: string,"description"?: string,"icon"?: string,"id"?: string,"is_published"?: boolean,"slug"?: string,"sort"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guidelines_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "brand_id": string | null,"brand_role": Database["public"]['Enums']["brand_role"] | null,"created_at": string,"created_by": string | null,"email": string | null,"expires_at": string,"id": string,"max_uses": number | null,"revoked": boolean,"token": string,"use_count": number,"workspace_id": string,"workspace_role": Database["public"]['Enums']["workspace_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id"?: string | null,"brand_role"?: Database["public"]['Enums']["brand_role"] | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number | null,"revoked"?: boolean,"token"?: string,"use_count"?: number,"workspace_id": string,"workspace_role"?: Database["public"]['Enums']["workspace_role"]
                  }
                  Update: {
                    "brand_id"?: string | null,"brand_role"?: Database["public"]['Enums']["brand_role"] | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number | null,"revoked"?: boolean,"token"?: string,"use_count"?: number,"workspace_id"?: string,"workspace_role"?: Database["public"]['Enums']["workspace_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"mcp_grants": {
                  Row: {
                    "brand_ids": string[],"client_id": string,"client_name": string,"created_at": string,"last_used_at": string | null,"read_only": boolean,"updated_at": string,"user_id": string,"workspace_ids": string[]
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_ids"?: string[],"client_id": string,"client_name"?: string,"created_at"?: string,"last_used_at"?: string | null,"read_only"?: boolean,"updated_at"?: string,"user_id": string,"workspace_ids"?: string[]
                  }
                  Update: {
                    "brand_ids"?: string[],"client_id"?: string,"client_name"?: string,"created_at"?: string,"last_used_at"?: string | null,"read_only"?: boolean,"updated_at"?: string,"user_id"?: string,"workspace_ids"?: string[]
                  }
                  Relationships: []
                },"libraries": {
                  Row: {
                    "brand_id": string,"created_at": string,"description": string,"id": string,"kind": Database["public"]['Enums']["library_kind"],"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"description"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["library_kind"],"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["library_kind"],"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "libraries_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"page_revisions": {
                  Row: {
                    "brand_id": string,"created_at": string,"created_by": string | null,"id": string,"label": string,"page_id": string,"snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"label"?: string,"page_id": string,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"label"?: string,"page_id"?: string,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_revisions_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_revisions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_revisions_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "guideline_pages"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"text_styles": {
                  Row: {
                    "brand_id": string,"created_at": string,"font_family": string,"font_size": number,"font_weight": number,"id": string,"italic": boolean,"letter_spacing": number,"line_height": number,"name": string,"sample": string,"sort": number,"text_transform": string,"token": string,"usage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"created_at"?: string,"font_family": string,"font_size"?: number,"font_weight"?: number,"id"?: string,"italic"?: boolean,"letter_spacing"?: number,"line_height"?: number,"name": string,"sample"?: string,"sort"?: number,"text_transform"?: string,"token"?: string,"usage"?: string
                  }
                  Update: {
                    "brand_id"?: string,"created_at"?: string,"font_family"?: string,"font_size"?: number,"font_weight"?: number,"id"?: string,"italic"?: boolean,"letter_spacing"?: number,"line_height"?: number,"name"?: string,"sample"?: string,"sort"?: number,"text_transform"?: string,"token"?: string,"usage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "text_styles_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: {
              "brand_id": string,"brand_slug": string,"workspace_id": string,"workspace_slug": string
            }[]
                           },
"add_member_by_email":
{ Args: { "p_brand"?: string,"p_brand_role"?: Database["public"]['Enums']["brand_role"],"p_email": string,"p_workspace": string,"p_workspace_role"?: Database["public"]['Enums']["workspace_role"] }; Returns: string
                           },
"apply_brand_template":
{ Args: { "p_brand": string,"p_template": Json }; Returns: undefined
                           },
"brand_role_of":
{ Args: { "p_brand": string }; Returns: Database["public"]['Enums']["brand_role"]
                           },
"can_admin_brand":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"can_download_brand":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"can_edit_brand":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"can_view_brand":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"create_brand":
{ Args: { "p_name": string,"p_org_type"?: string,"p_tagline"?: string,"p_template"?: Json,"p_workspace": string }; Returns: {
              "cover_path": string | null,
"created_at": string,
"created_by": string | null,
"description": string,
"home": NonNullable<Json>,
"id": string,
"is_public": boolean,
"logo_path": string | null,
"name": string,
"org_type": string,
"public_downloads": boolean,
"public_until": string | null,
"slug": string,
"tagline": string,
"theme": NonNullable<Json>,
"updated_at": string,
"visibility": Database["public"]['Enums']["brand_visibility"],
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "brands"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_workspace":
{ Args: { "p_description"?: string,"p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"description": string,
"id": string,
"name": string,
"slug": string
            }
                          SetofOptions: {
        from: "*"
        to: "workspaces"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "brand_name": string,"brand_role": Database["public"]['Enums']["brand_role"],"email_bound": boolean,"is_valid": boolean,"workspace_name": string,"workspace_role": Database["public"]['Enums']["workspace_role"]
            }[]
                           },
"is_brand_member":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"leave_workspace":
{ Args: { "p_workspace": string }; Returns: undefined
                           },
"mcp_allows_brand":
{ Args: { "p_brand": string }; Returns: boolean
                           },
"mcp_allows_workspace":
{ Args: { "p_workspace": string }; Returns: boolean
                           },
"mcp_read_only":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mcp_scope":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"oauth_client_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"save_mcp_grant":
{ Args: { "p_brands": string[],"p_client_id": string,"p_client_name": string,"p_read_only"?: boolean,"p_workspaces": string[] }; Returns: {
              "brand_ids": string[],"client_id": string,"client_name": string,"created_at": string,"last_used_at": string | null,"read_only": boolean,"updated_at": string,"user_id": string,"workspace_ids": string[]
            }
                          SetofOptions: {
        from: "*"
        to: "mcp_grants"
        isOneToOne: true
        isSetofReturn: false
      } },
"search_brand":
{ Args: { "p_brand": string,"p_query": string }; Returns: {
              "guideline_slug": string,"hex": string,"id": string,"kind": string,"library_slug": string,"page_slug": string,"snippet": string,"thumb_path": string,"title": string
            }[]
                           },
"shares_workspace_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"slugify":
{ Args: { "value": string }; Returns: string
                           },
"storage_brand_id":
{ Args: { "p_name": string }; Returns: string
                           },
"unique_slug":
{ Args: { "p_base": string,"p_table": string }; Returns: string
                           },
"workspace_role_of":
{ Args: { "p_workspace": string }; Returns: Database["public"]['Enums']["workspace_role"]
                           }
          }
          Enums: {
            "brand_role": "admin"|"editor"|"viewer","brand_visibility": "private"|"workspace","library_kind": "media"|"logos"|"icons"|"documents"|"templates"|"audio_video","page_kind": "chapter"|"page","workspace_role": "owner"|"admin"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "brand_role": ["admin", "editor", "viewer"],"brand_visibility": ["private", "workspace"],"library_kind": ["media", "logos", "icons", "documents", "templates", "audio_video"],"page_kind": ["chapter", "page"],"workspace_role": ["owner", "admin", "member"]
          }
        }
} as const
