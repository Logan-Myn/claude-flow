import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { useWorkspaceStore, useActiveWorkspace } from '../store/workspace';
import { FileTree } from './FileTree';
import { Editor } from './Editor';
import { Terminal } from './Terminal';
import { WorkspaceTabs } from './WorkspaceTabs';

export function Layout() {
  const activeWorkspace = useActiveWorkspace();
  const panelWidths = useWorkspaceStore((s) => s.panelWidths);
  const setPanelWidths = useWorkspaceStore((s) => s.setPanelWidths);

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-primary)]">
      <WorkspaceTabs />

      {activeWorkspace ? (
        <div className="flex-1">
          <Allotment
            defaultSizes={[panelWidths.tree, panelWidths.editor, panelWidths.terminal]}
            onChange={(sizes) => {
              if (sizes.length === 3) {
                setPanelWidths({
                  tree: sizes[0],
                  editor: sizes[1],
                  terminal: sizes[2],
                });
              }
            }}
          >
            <Allotment.Pane minSize={150} maxSize={400}>
              <div className="h-full bg-[var(--bg-secondary)]">
                <FileTree workspace={activeWorkspace} />
              </div>
            </Allotment.Pane>

            <Allotment.Pane minSize={200}>
              <div className="h-full bg-[var(--bg-secondary)]">
                <Editor workspace={activeWorkspace} />
              </div>
            </Allotment.Pane>

            <Allotment.Pane minSize={200}>
              <div className="h-full bg-[var(--bg-primary)]">
                <Terminal workspace={activeWorkspace} />
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-[var(--text-muted)] text-lg">No workspace open</div>
            <p className="text-[var(--text-secondary)] text-sm">
              Click <span className="text-[var(--accent)]">+ New</span> to open a folder
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
