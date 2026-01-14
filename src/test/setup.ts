import '@testing-library/jest-dom'

// Mock scrollIntoView for JSDOM (not available in test environment)
Element.prototype.scrollIntoView = () => {}
