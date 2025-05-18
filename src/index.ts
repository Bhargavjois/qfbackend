import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Client } from 'pg'
import { config } from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables from .env file
config()

// Define types for context variables
type Variables = {
  dbClient: Client
}

// Initialize Hono app with the Variables type
const app = new Hono<{ Variables: Variables }>()

// This allows requests from *any* origin
app.use('*', cors())

// Helper function to establish a database connection
const connectToDB = async (): Promise<Client> => {
  const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '10708', 10),
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: process.env.DB_SSL === 'true',
      ca: readFileSync('./ca.pem').toString(),
    },
  }
  const client = new Client(dbConfig)
  await client.connect()
  return client
}

// Helper function to disconnect from the database
const disconnectFromDB = async (client: Client): Promise<void> => {
  await client.end()
}

// Helper function to slugify the title
function slugify(str: string) {
  if (!str) {
    return ''
  }

  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

// Database middleware
app.use(async (c, next) => {
  const client = await connectToDB()
  c.set('dbClient', client)
  await next()
  await disconnectFromDB(client)
})

app.get('/api/posts', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  try {
    const posts = await client.query(
      'SELECT * FROM posts ORDER BY created_date DESC'
    )
    return c.json(posts.rows)
  } catch (error) {
    console.error('Error:', error)
    return c.status(500)
  }
})

app.post('/api/posts', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  try {
    const { title, content } = await c.req.json()
    const slug = slugify(title)
    const result = await client.query(
      'INSERT INTO posts (slug, title, content) VALUES ($1, $2, $3) RETURNING *',
      [slug, title, content]
    )
    return c.json(result.rows[0], 201) // Returns the newly created post
  } catch (error) {
    console.error('Error creating post:', error)
    return c.status(500)
  }
})

app.put('/api/posts/:slug', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  const slug = c.req.param('slug')
  try {
    const body = await c.req.json()
    const { title, content } = body
    const result = await client.query(
      'UPDATE posts SET title = $1, content = $2 WHERE slug = $3 RETURNING *',
      [title, content, slug]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Post not found' }, 404)
    }
    return c.json(result.rows[0], 201)
  } catch (error: any) {
    console.error(`Error updating post ${slug}:`, error)
    return c.json(
      { error: 'Failed to update post', message: error.message },
      500
    )
  }
})

app.delete('/api/posts/:slug', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  const slug = c.req.param('slug')
  try {
    const result = await client.query(
      'DELETE FROM posts WHERE slug = $1 RETURNING *',
      [slug]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Post not found' }, 404)
    }
    return c.json(
      { message: `Post with slug ${slug} deleted successfully` },
      201
    )
  } catch (error: any) {
    console.error(`Error deleting post ${slug}:`, error)
    return c.json(
      { error: 'Failed to delete post', message: error.message },
      500
    )
  }
})

app.get('/api/drafts', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  try {
    const posts = await client.query(
      'SELECT * FROM drafts ORDER BY created_date DESC'
    )
    return c.json(posts.rows)
  } catch (error) {
    console.error('Error:', error)
    return c.status(500)
  }
})

app.post('/api/drafts', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  try {
    const { title, content } = await c.req.json()
    const slug = slugify(title)
    const result = await client.query(
      'INSERT INTO drafts (slug, title, content) VALUES ($1, $2, $3) RETURNING *',
      [slug, title, content]
    )
    return c.json(result.rows[0], 201) // Returns the newly created draft
  } catch (error) {
    console.error('Error creating draft:', error)
    return c.status(500)
  }
})

app.put('/api/drafts/:slug', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  const slug = c.req.param('slug')
  try {
    const body = await c.req.json()
    const { title, content } = body
    const result = await client.query(
      'UPDATE drafts SET title = $1, content = $2 WHERE slug = $3 RETURNING *',
      [title, content, slug]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Draft not found' }, 404)
    }
    return c.json(result.rows[0], 201)
  } catch (error: any) {
    console.error(`Error updating draft ${slug}:`, error)
    return c.json(
      { error: 'Failed to update draft', message: error.message },
      500
    )
  }
})

app.delete('/api/drafts/:slug', async (c) => {
  // Using the DB client from middleware
  const client = c.get('dbClient')
  const slug = c.req.param('slug')
  try {
    const result = await client.query(
      'DELETE FROM drafts WHERE slug = $1 RETURNING *',
      [slug]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Draft not found' }, 404)
    }
    return c.json(
      { message: `Draft with slug ${slug} deleted successfully` },
      201
    )
  } catch (error: any) {
    console.error(`Error deleting draft ${slug}:`, error)
    return c.json(
      { error: 'Failed to delete draft', message: error.message },
      500
    )
  }
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  }
)
