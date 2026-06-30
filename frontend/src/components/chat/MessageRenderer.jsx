import React from 'react';

export const MessageRenderer = ({ text }) => {
  // Function to process special genui widget tags
  const processWidgets = (content) => {
    // Regex to match the custom genui blocks
    const widgetRegex = /genui({[^}]*})/g;
    const parts = [];
    let lastIndex = 0;

    let match;
    while ((match = widgetRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }

      // Try to parse the JSON widget
      try {
        const widgetData = JSON.parse(match[1]);
        parts.push({ type: 'widget', data: widgetData });
      } catch (e) {
        parts.push({ type: 'text', content: match[0] }); // fallback to raw string if parsing fails
      }

      lastIndex = widgetRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0) return <p className="markdown-text">{content}</p>;

    return (
      <div className="rendered-message-content">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            // Simple split by double newline for paragraphs
            return part.content.split('\n\n').map((p, i) => (
              p.trim() ? <p key={`text-${index}-${i}`} className="markdown-text">{p}</p> : null
            ));
          } else if (part.type === 'widget') {
            if (part.data.math_block_widget_always_prefetch_v2) {
              return (
                <div key={`widget-${index}`} className="math-widget glass">
                  <span className="math-icon">∑</span>
                  <div className="math-content">
                    {part.data.math_block_widget_always_prefetch_v2.content}
                  </div>
                </div>
              );
            }
            if (part.data.chart_widget) {
               return (
                <div key={`widget-${index}`} className="chart-widget glass">
                  <span className="chart-icon">📊</span>
                  <div className="chart-content">
                    {part.data.chart_widget.title || "Visualization"}
                  </div>
                </div>
               )
            }
            // Fallback for unknown widgets
            return <div key={`widget-${index}`} className="unknown-widget glass">Interactive Widget</div>;
          }
          return null;
        })}
      </div>
    );
  };

  return <>{processWidgets(text)}</>;
};