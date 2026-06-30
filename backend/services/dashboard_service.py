from __future__ import annotations
from config import supabase
from collections import Counter
from datetime import datetime

class DashboardService:
    """Service to handle dashboard analytics logic using Supabase."""

    @staticmethod
    def get_stats() -> dict:
        """
        Calculates and returns student performance statistics.
        Aggregates data from Supabase 'chats' table.
        """
        if supabase is None:
            return {
                "total_questions": 0,
                "top_topics": ["No data yet"],
                "weak_areas": ["Database not connected"],
                "recent_questions": []
            }

        try:
            # Get all chat entries from Supabase
            response = supabase.table("chats").select("*").order("timestamp", desc=True).execute()
            chats = response.data or []
        except Exception as e:
            print(f"Supabase Analytics Error: {e}")
            chats = []
        
        # Count occurrences of each category
        categories = [item["category"] for item in chats if item.get("category")]
        category_counts = Counter(categories)
        
        # Get top 3 topics
        top_topics = [cat for cat, count in category_counts.most_common(3)]
        if not top_topics:
            top_topics = ["No data yet"]

        # Basic logic for weak areas
        weak_areas = ["Topic Analysis Pending"] if not chats else [cat for cat, count in category_counts.most_common(2)]

        return {
            "total_questions": len(chats),
            "top_topics": top_topics,
            "weak_areas": weak_areas,
            "recent_questions": chats[:5]
        }

dashboard_service = DashboardService()
