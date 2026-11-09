import { layoutMindMapTree } from '../mindmap-layout';

describe('mindmap-layout', () => {
  it('lays out central root and branches horizontally', () => {
    const root = { label: 'Vacation 2026' };
    const branches = [
      { label: 'Hotels', content: 'Book resort' },
      { label: 'Flights', content: 'Direct flights' },
      { label: 'Packing', parentId: 'Hotels' },
    ];

    const result = layoutMindMapTree(root, branches, { orientation: 'horizontal' });

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    const rootNode = result.nodes[0];
    expect(rootNode.label).toBe('Vacation 2026');
    expect(rootNode.x).toBe(40);
  });
});
