'use client';

import { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  GitMerge,
  Check,
  Clock,
  Edit3,
  Search,
  XCircle
} from 'lucide-react';
import { useBranchStore, Branch } from '@/store/branchStore';

export default function BranchManagementView() {
  const {
    branches,
    currentBranch: currentBranchId,
    createBranch,
    switchBranch,
    deleteBranch,
    mergeBranch,
    getCurrentBranch,
    updateBranchChat, // Assuming we might want to update description or other metadata
  } = useBranchStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Branch | null>(null);
  
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDescription, setNewBranchDescription] = useState('');
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);
  
  const [targetMergeBranchId, setTargetMergeBranchId] = useState('');
  const [sourceMergeBranchId, setSourceMergeBranchId] = useState<string | null>(null);

  const [editedBranchName, setEditedBranchName] = useState('');
  const [editedBranchDescription, setEditedBranchDescription] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    setIsHydrated(true);
    const current = getCurrentBranch();
    if (current) {
        setSourceMergeBranchId(current.id);
    }
  }, [getCurrentBranch]);

  const currentBranchData = isHydrated ? getCurrentBranch() : null;

  const handleSwitchBranch = (branchId: string) => {
    switchBranch(branchId);
  };

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    createBranch(newBranchName, newBranchDescription, copyFromCurrent);
    setNewBranchName('');
    setNewBranchDescription('');
    setShowCreateModal(false);
  };

  const handleInitiateMerge = (sourceId: string) => {
    setSourceMergeBranchId(sourceId);
    setTargetMergeBranchId(''); // Reset target
    setShowMergeModal(true);
  };
  
  const executeMerge = () => {
    if (!sourceMergeBranchId || !targetMergeBranchId) return;
    mergeBranch(sourceMergeBranchId, targetMergeBranchId);
    setShowMergeModal(false);
    setSourceMergeBranchId(null);
    setTargetMergeBranchId('');
  };

  const handleDeleteBranch = (branchId: string) => {
    if (window.confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      deleteBranch(branchId);
    }
  };

  const handleEditBranch = (branch: Branch) => {
    setShowEditModal(branch);
    setEditedBranchName(branch.name);
    setEditedBranchDescription(branch.description || '');
  };

  const saveBranchEdit = () => {
    if (!showEditModal || !editedBranchName.trim()) return;
    // Note: branchStore doesn't have a direct 'updateBranchDetails' function.
    // We might need to add one, or for now, this is a conceptual placeholder.
    // A workaround could be to update parts of the branch object if the store allows,
    // e.g., if chatHistory could store metadata, or if a new action is added to branchStore.
    // For now, we'll log it.
    console.log(`Branch ${showEditModal.id} new name: ${editedBranchName}, new description: ${editedBranchDescription}`);
    // Example: updateBranchMetadata(showEditModal.id, { name: editedBranchName, description: editedBranchDescription });
    
    // To simulate an update if the store supported it:
    // const updatedBranches = branches.map(b => 
    //   b.id === showEditModal.id 
    //     ? { ...b, name: editedBranchName, description: editedBranchDescription, lastModified: new Date() } 
    //     : b
    // );
    // This would require a setBranches action in the store.
    // For now, we'll assume such an update mechanism or add it later.
    
    setShowEditModal(null);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredBranches = isHydrated 
    ? branches.filter(branch => branch.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  if (!isHydrated) {
    return <div className="p-4 text-gray-400">Loading branches...</div>;
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Branches</h2>
        <button
          onClick={() => {
            setNewBranchName('');
            setNewBranchDescription('');
            setCopyFromCurrent(true);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors text-white"
        >
          <Plus size={16} />
          New Branch
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search branches..."
          className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredBranches.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <GitBranch size={48} className="mx-auto mb-2 opacity-50" />
            <p>No branches found{searchTerm && ` for "${searchTerm}"`}.</p>
            {!searchTerm && <p className="text-sm">Create a new branch to get started.</p>}
          </div>
        )}
        {filteredBranches.map((branch) => (
          <div
            key={branch.id}
            className={`p-3 rounded-lg transition-all duration-200 group
              ${branch.id === currentBranchId ? 'bg-blue-600/20 border border-blue-500/30 shadow-md' : 'bg-gray-700/50 hover:bg-gray-600/70 border border-transparent hover:border-gray-500/50'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSwitchBranch(branch.id)}>
                <div className="flex items-center gap-2 mb-1">
                  {branch.isMain ? <GitBranch className="text-green-400 flex-shrink-0" size={18} /> : <GitBranch className="text-blue-400 flex-shrink-0" size={18} />}
                  <span className={`text-md font-semibold truncate ${branch.id === currentBranchId ? 'text-blue-300' : 'text-white'}`}>
                    {branch.name}
                  </span>
                  {branch.id === currentBranchId && (
                    <Check size={16} className="text-green-400 flex-shrink-0" />
                  )}
                </div>
                {branch.description && (
                  <p className="text-xs text-gray-400 truncate mb-1">{branch.description}</p>
                )}
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> Last updated: {formatDate(branch.lastModified)}
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {!branch.isMain && (
                  <>
                    <button
                      onClick={() => handleEditBranch(branch)}
                      className="p-1.5 hover:bg-gray-600 rounded-md text-gray-400 hover:text-yellow-400 transition-colors"
                      title="Edit branch"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleInitiateMerge(branch.id)}
                      className="p-1.5 hover:bg-gray-600 rounded-md text-gray-400 hover:text-green-400 transition-colors"
                      title="Merge this branch"
                    >
                      <GitMerge size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(branch.id)}
                      className="p-1.5 hover:bg-gray-600 rounded-md text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete branch"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Create New Branch</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XCircle size={20}/>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Branch Name</label>
                <input type="text" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., feature/new-login" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
                <input type="text" value={newBranchDescription} onChange={(e) => setNewBranchDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Implementing OAuth2 login" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="copyFiles" checked={copyFromCurrent} onChange={(e) => setCopyFromCurrent(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800" />
                <label htmlFor="copyFiles" className="text-sm text-gray-300">Copy files from current branch ({currentBranchData?.name || 'main'})</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded transition-colors">Cancel</button>
              <button onClick={handleCreateBranch} disabled={!newBranchName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Branch Modal */}
      {showMergeModal && sourceMergeBranchId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md shadow-xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Merge Branch</h3>
                <button onClick={() => setShowMergeModal(false)} className="text-gray-400 hover:text-white">
                    <XCircle size={20}/>
                </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Merge <span className="font-semibold text-blue-400">{branches.find(b=>b.id===sourceMergeBranchId)?.name}</span> into:
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Target Branch</label>
                <select value={targetMergeBranchId} onChange={(e) => setTargetMergeBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500">
                  <option value="">Select target branch</option>
                  {branches.filter(b => b.id !== sourceMergeBranchId).map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
              <div className="bg-yellow-600/20 border border-yellow-500/30 rounded p-3 mt-2">
                <p className="text-xs text-yellow-300">
                  This will copy all files from '{branches.find(b=>b.id===sourceMergeBranchId)?.name}' into the selected target branch. The target branch's existing files will be overwritten. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded transition-colors">Cancel</button>
              <button onClick={executeMerge} disabled={!targetMergeBranchId}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors">Merge</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Branch Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Edit Branch: {showEditModal.name}</h3>
                <button onClick={() => setShowEditModal(null)} className="text-gray-400 hover:text-white">
                    <XCircle size={20}/>
                </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Branch Name</label>
                <input type="text" value={editedBranchName} onChange={(e) => setEditedBranchName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <input type="text" value={editedBranchDescription} onChange={(e) => setEditedBranchDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditModal(null)}
                className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded transition-colors">Cancel</button>
              <button onClick={saveBranchEdit} disabled={!editedBranchName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
