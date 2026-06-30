from __future__ import annotations
import random

KEYWORD_RESPONSES = {
    "python": [
        "Python is a versatile, high-level programming language known for its readability and large ecosystem of libraries.",
        "Python is the go-to language for Data Science, AI, and Web Development. Would you like to learn about its syntax or libraries?",
        "As a TeacherClone, I love Python! It's white-space sensitive and great for beginners and experts alike.",
        "Did you know Python was named after Monty Python, not the snake? It's a fun and powerful language!",
        "Python's slogan is 'There should be one-- and preferably only one --obvious way to do it.'",
        "From list comprehensions to decorators, Python has many elegant features to explore."
    ],
    "react": [
        "React is a popular JavaScript library for building user interfaces, developed by Meta.",
        "React uses a component-based architecture and a virtual DOM for efficient rendering. Need help with hooks or props?",
        "Modern web development often starts with React. It's all about building reusable UI components!",
        "React's declarative nature makes it easy to create interactive UIs. Every piece of UI is a component!",
        "State and Props are the heart of React components. Understanding them is key to mastering React.",
        "Hooks like useState and useEffect revolutionized how we write React components."
    ],
    "javascript": [
        "JavaScript is the language of the web! It brings interactivity to websites and runs on both client and server.",
        "From ES6 features like arrow functions to async/await, JavaScript is constantly evolving.",
        "JavaScript is essential for front-end development, especially with frameworks like React, Vue, and Angular.",
        "Did you know JavaScript was created in just 10 days? It has come a long way since then!",
        "Node.js allows you to run JavaScript on the server, making it a full-stack language."
    ],
    "algebra": [
        "Algebra is a branch of mathematics dealing with symbols and the rules for manipulating those symbols.",
        "In algebra, we use variables like x and y to represent numbers in equations. Want to solve a linear equation?",
        "Algebra is the foundation for higher-level math. It helps us describe relationships between quantities.",
        "Whether it's factoring quadratics or solving for x, algebra is a key skill for any student!",
        "The word 'Algebra' comes from the Arabic word 'al-jabr', meaning 'reunion of broken parts.'",
        "Systems of equations and inequalities are core parts of the algebra curriculum."
    ],
    "calculus": [
        "Calculus is the mathematical study of continuous change, founded by Newton and Leibniz.",
        "Derivatives help us find the rate of change, while integrals help us find the area under a curve.",
        "Calculus is essential for physics, engineering, and economics. Ready to talk about limits?",
        "The Fundamental Theorem of Calculus links differentiation and integration. It's a beautiful concept!",
        "Differential calculus is about slopes, and integral calculus is about accumulation."
    ],
    "geometry": [
        "Geometry is the branch of math that deals with the properties and relations of points, lines, surfaces, and solids.",
        "From Pythagorean theorem to trigonometry, geometry helps us understand the shapes around us.",
        "Euclidean geometry is the classic study of plane and solid figures. Need help with proofs?",
        "Pi (π) is a fundamental constant in geometry, representing the ratio of a circle's circumference to its diameter.",
        "Calculating volume and surface area is a key part of applied geometry."
    ],
    "physics": [
        "Physics is the study of matter, motion, energy, and force. It's how we understand the universe!",
        "From Newton's laws to quantum mechanics, physics explains how things work at every scale.",
        "Need help with velocity, acceleration, or thermodynamics? Physics can be challenging but fascinating!",
        "Physics is everywhere! From the arc of a basketball to the light from distant stars.",
        "Einstein's E=mc² is perhaps the most famous equation in physics, relating energy and mass.",
        "Electromagnetism and gravity are two of the four fundamental forces studied in physics."
    ],
    "chemistry": [
        "Chemistry is the study of matter, its properties, and how it changes during chemical reactions.",
        "The periodic table is a chemist's best friend! Are you interested in organic or inorganic chemistry?",
        "Chemistry explains the world at an atomic level—how atoms bond to form molecules.",
        "From acids and bases to the structure of an atom, chemistry is full of exciting discoveries!",
        "Chemical equilibrium and kinetics help us understand how fast and to what extent reactions occur.",
        "Molecule structures and functional groups are the building blocks of organic chemistry."
    ],
    "biology": [
        "Biology is the study of life and living organisms, from single-celled bacteria to complex ecosystems.",
        "Cell theory, evolution, and genetics are the pillars of modern biology. What area are we exploring today?",
        "Biology helps us understand how our bodies work and how different species interact with their environment.",
        "Photosynthesis, DNA replication, and mitosis—biology is the science of life itself!",
        "Ecology studies how organisms interact with each other and their physical surroundings.",
        "The human genome project has revolutionized our understanding of genetics and medicine."
    ],
    "history": [
        "History is the study of past events, particularly in human affairs. We learn from the past to build a better future.",
        "History is full of stories about civilizations, conflicts, and triumphs. Which era are you interested in?",
        "Studying history helps us understand how we got to where we are today. Let's explore a specific time period!",
        "Every artifact and document tells a story. History is the collective memory of humanity.",
        "The Renaissance was a period of incredible artistic and intellectual growth in Europe.",
        "World War II reshaped the global political landscape and led to the creation of the United Nations."
    ],
    "economics": [
        "Economics is the social science that studies the production, distribution, and consumption of goods and services.",
        "Microeconomics looks at individual choices, while macroeconomics examines the economy as a whole.",
        "Supply and demand, inflation, and market structures—economics helps us understand how resources are allocated.",
        "Economics isn't just about money; it's about how people make decisions in a world of scarcity.",
        "Opportunity cost is a fundamental economic concept: the value of the next best alternative given up.",
        "Game theory is a fascinating branch of economics that studies strategic decision-making."
    ],
    "geography": [
        "Geography is the study of places and the relationships between people and their environments.",
        "Physical geography focuses on natural features, while human geography looks at cultures and communities.",
        "From mountain ranges to urban development, geography covers the entire surface of our planet.",
        "Maps are just the beginning! Geography helps us understand global patterns and local processes.",
        "Tectonic plates and climate zones are key topics in physical geography.",
        "Demographics and urbanization are central to the study of human geography."
    ],
    "artificial intelligence": [
        "Artificial Intelligence (AI) is the simulation of human intelligence by machines, especially computer systems.",
        "Machine learning, neural networks, and natural language processing are all part of the AI landscape.",
        "AI is transforming how we work and learn. I'm actually an AI myself!",
        "The goal of AI is to create systems that can perform tasks that typically require human intelligence.",
        "Deep learning is a subset of machine learning based on artificial neural networks.",
        "Ethical AI and bias in algorithms are critical areas of research in modern AI."
    ],
    "hello": [
        "Hello! I am TeacherClone, your AI-powered teaching assistant. How can I help you today?",
        "Hi there! Ready to dive into some learning? Ask me anything!",
        "Greetings! I'm here to support your educational journey. What's on your mind?",
        "Hey! Always happy to see a curious student. What shall we learn today?",
        "Welcome! I'm TeacherClone. Whether it's homework or curiosity, I'm here to help."
    ],
    "who are you": [
        "I am TeacherClone, an AI designed to help students learn and master various subjects.",
        "Think of me as your personal tutor, available 24/7 to explain complex topics.",
        "I am TeacherClone! I use advanced AI to provide clear and concise educational support.",
        "I'm your digital companion on the path to knowledge. I can explain anything from math to history!",
        "I'm TeacherClone, built to bridge the gap between classroom learning and individual study."
    ]
}

def get_keyword_answer(question: str) -> dict:
    """
    Checks the question for keywords and returns a random variation if a match is found.
    """
    question_lower = question.lower()
    
    for keyword, variations in KEYWORD_RESPONSES.items():
        if keyword in question_lower:
            return {
                "answer": random.choice(variations),
                "source": "Knowledge Base (Keyword Match)",
                "confidence": 1.0
            }
            
    return None
