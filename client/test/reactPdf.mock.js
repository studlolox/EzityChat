const React = require('react');

module.exports = {
  Document: ({ children, onLoadSuccess }) => {
    React.useEffect(() => {
      if (onLoadSuccess) onLoadSuccess({ numPages: 1 });
    }, [onLoadSuccess]);
    return React.createElement('div', { 'data-testid': 'mock-pdf-document' }, children);
  },
  Page: ({ pageNumber }) =>
    React.createElement(
      'div',
      { 'data-testid': `mock-pdf-page-${pageNumber}` },
      `Page ${pageNumber}`,
    ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
};
