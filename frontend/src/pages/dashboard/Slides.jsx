import React from 'react';
import { FileText, Download, Share2, Eye, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Slides() {
  const slides = [
    { title: "Introduction to Thermodynamics", pages: 24, size: "4.2 MB", date: "Oct 15, 2024" },
    { title: "Organic Chemistry Basics", pages: 18, size: "3.1 MB", date: "Oct 14, 2024" },
    { title: "Fluid Dynamics - Part 1", pages: 32, size: "5.5 MB", date: "Oct 12, 2024" },
  ];

  return (
    <div className="slides-page fade-in">
      <header className="page-header">
        <div className="header-text">
          <h2>Teaching Slides</h2>
          <p>Manage and present your lecture presentations</p>
        </div>
        <button className="btn-primary">
          <FileText size={18} />
          Upload New
        </button>
      </header>

      <div className="slides-list">
        {slides.map((slide, i) => (
          <motion.div 
            key={i} 
            className="slide-row"
            whileHover={{ x: 5 }}
          >
            <div className="slide-icon">
              <FileText size={22} />
            </div>
            <div className="slide-details">
              <h3>{slide.title}</h3>
              <p>{slide.pages} Pages • {slide.size} • Uploaded {slide.date}</p>
            </div>
            <div className="slide-actions">
              <button className="icon-btn"><Eye size={18} /></button>
              <button className="icon-btn"><Download size={18} /></button>
              <button className="icon-btn"><Share2 size={18} /></button>
              <button className="icon-btn"><MoreVertical size={18} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
