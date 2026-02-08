# Parallel Discussion Layout Concept

## Goal
To display independent, parallel streams of thought from multiple agents (Opus, Codex, Gemini) simultaneously, without forcing a linear vertical hierarchy that implies dependency.

## The "Cat Tree" Grid System

Instead of a single vertical column, we switch to a Responsive Grid when `mode === 'ideate'`.

### Layout Logic

```css
.chat-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Standard Serial Message */
.message-row {
  width: 100%;
}

/* Parallel Group Container */
.parallel-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
  padding: 1rem;
  background-color: rgba(0,0,0,0.02); /* Very subtle grouping background */
  border-radius: 12px;
  border: 1px dashed #E0E0E0;
}

/* When on small screens, stack them but keep the visual grouping */
@media (max-width: 768px) {
  .parallel-group {
    grid-template-columns: 1fr;
  }
}
```

### Visual Cues for Independence

1.  **Top Label**: A small badge at the top of the group saying "✨ Brainstorming in parallel..."
2.  **Connecting Lines**: Unlike the main thread where lines go Top-to-Bottom, here there are no lines connecting these parallel blocks to each other. They all branch from the *parent* message.
3.  **Sync Indicator**:
    *   If Opus finishes first, his card shows full opacity.
    *   If Gemini is still typing, her card shows the "Thinking" animation.
    *   The "Next" linear message only appears after ALL parallel streams resolve.

## Pseudo-Component (React)

```tsx
<ChatStream>
  {messages.map(msg => {
    if (msg.type === 'parallel_group') {
       return (
         <div className="parallel-group">
           <div className="parallel-header">
             <span className="icon">⚡️</span> Parallel Thoughts
           </div>
           {msg.streams.map(stream => (
             <div className="agent-column">
               <AgentAvatar agent={stream.agentId} />
               <MessageBubble content={stream.content} />
             </div>
           ))}
         </div>
       )
    }
    return <MessageRow msg={msg} />
  })}
</ChatStream>
```
