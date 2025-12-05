# Bluesky Feed Reader - Implementation Plan

## Project Goal
Build a personal app that connects to your Bluesky feed, loads posts from your network, and does summarization.

## Architecture Decisions
- **User Scope**: Personal app (just for you)
- **API Strategy**: Server-side API routes in Next.js
- **Security**: Bluesky credentials stored in environment variables

## Implementation Plan

### Phase 1: Setup & Authentication
1. Install AT Protocol SDK (`@atproto/api`)
2. Create `.env.local` with your Bluesky credentials (handle and app password)
3. Build API route (`/api/bluesky/feed`) to:
   - Authenticate with Bluesky using your credentials
   - Fetch posts from your timeline
   - Return formatted post data

### Phase 2: Frontend Display
4. Create a feed component to display posts
5. Add loading states and error handling
6. Style the feed with Tailwind CSS

### Phase 3: Test
7. Test the connection and display posts from your feed

### Future: Summarization
- Add AI summarization of posts (TBD - separate API route)
- Could use OpenAI, Anthropic, or other LLM APIs

## Benefits of This Approach
- Credentials stay secure on the server (not exposed to browser)
- Easy to add caching and rate limiting
- Can process/summarize posts server-side before sending to client
- Clean separation of concerns
