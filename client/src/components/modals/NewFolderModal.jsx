import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FolderPlusIcon } from "lucide-react";

export function NewFolderModal({ isOpen, onClose, onCreate, isLoading }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName("");
    }
  };

  const handleClose = () => {
    setName("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Folder">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Folder Name"
          icon={FolderPlusIcon}
          placeholder="Enter folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={!name.trim()}
          >
            Create Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
}

