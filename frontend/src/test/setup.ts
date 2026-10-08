import '@testing-library/jest-dom/vitest'

Element.prototype.scrollIntoView = () => {}
URL.createObjectURL = () => 'blob:preview'
URL.revokeObjectURL = () => {}
