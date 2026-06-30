from __future__ import annotations
import os
import chromadb
from chromadb.config import Settings as ChromaSettings

# Persist ChromaDB data next to this backend directory
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")


class VectorService:
    """
    Manages ChromaDB interactions for the RAG pipeline.

    Responsibilities:
      - Initialize (or reopen) the persistent ChromaDB collection.
      - Store text chunks together with their pre-computed embeddings.
      - Query the collection for the most relevant chunks given a query embedding.

    Future-ready design:
      - The `collection_name` parameter makes it trivial to support
        per-user or per-document knowledge bases.
    """

    def __init__(self, collection_name: str = "teacherclone_kb"):
        self.client = chromadb.PersistentClient(
            path=os.path.abspath(CHROMA_PATH),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        # get_or_create so restarts never wipe data
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},  # cosine similarity
        )

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add_documents(
        self,
        chunks: list[str],
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict] | None = None,
    ) -> None:
        """
        Store text chunks with their pre-computed embeddings in ChromaDB.

        Args:
            chunks:     The raw text content for each chunk.
            ids:        Unique string IDs (one per chunk).
            embeddings: Dense float vectors (one per chunk).
            metadatas:  Optional dicts (e.g., source filename, page number).
        """
        if not chunks:
            return

        self.collection.upsert(
            documents=chunks,
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas or [{}] * len(chunks),
        )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def query_similar(
        self,
        query_embedding: list[float],
        n_results: int = 3,
        subject_id: str = None,
    ) -> list[str]:
        """
        Return the top-n most similar document chunks for a query embedding.
        Filters by subject_id if provided.

        Args:
            query_embedding: Dense float vector for the user's question.
            n_results:       Number of chunks to retrieve.
            subject_id:      Optional subject ID to filter the RAG context chunks.

        Returns:
            A flat list of matching document strings, ordered by relevance.
        """
        total_docs = self.collection.count()
        if total_docs == 0:
            return []

        # Can't request more results than documents stored
        n = min(n_results, total_docs)

        # Build metadata where filter
        where_filter = None
        if subject_id:
            where_filter = {"subject_id": subject_id}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n,
            where=where_filter,
            include=["documents"],
        )

        # results["documents"] is [[doc1, doc2, ...]] — unwrap the outer list
        docs = results.get("documents", [[]])[0]
        return docs

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def count(self) -> int:
        """Return the number of stored chunks."""
        return self.collection.count()

    def delete_document(self, file_id: str, filename: str = None) -> None:
        """Purge all vector chunks corresponding to a file_id or source filename."""
        total_docs = self.collection.count()
        if total_docs == 0:
            return

        # Delete by file_id (since we are adding it to metadata)
        try:
            self.collection.delete(where={"file_id": file_id})
        except Exception as e:
            print(f"ChromaDB delete by file_id error: {e}")

        # Fallback to delete by source filename
        if filename:
            try:
                self.collection.delete(where={"source": filename})
            except Exception as e:
                print(f"ChromaDB delete by filename error: {e}")

    def reset(self) -> None:
        """Delete and recreate the collection (useful for testing)."""
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection.name,
            metadata={"hnsw:space": "cosine"},
        )


# Singleton — imported by ingest_service and chat_service
vector_service = VectorService()
