#!/usr/bin/env python3
import os
import json
import re
import shutil
from datetime import datetime

# Paths
BRAIN_DIR = "/Users/ly/.gemini/antigravity-ide/brain"
WORKSPACE_DIR = "/Users/ly/Desktop/antigravity project/suivi-ca-app"
BACKUP_DIR = os.path.join(WORKSPACE_DIR, "project_docs", "history")

def slugify(text):
    """Convert text to a clean URL/filename friendly string."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '_', text).strip('_')
    return text[:50]

def parse_iso_date(date_str):
    """Parse ISO date and return a readable string."""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S'), dt.strftime('%Y-%m-%d')
    except Exception:
        return "Date inconnue", "unknown-date"

def extract_metadata_from_walkthrough(walkthrough_path):
    """Extract Title from a walkthrough.md file."""
    if not os.path.exists(walkthrough_path):
        return None
    try:
        with open(walkthrough_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('#'):
                    # Strip leading # and clean up
                    title = line.lstrip('#').strip()
                    if title.lower().startswith('walkthrough -'):
                        title = title[13:].strip()
                    elif title.lower().startswith('walkthrough:'):
                        title = title[12:].strip()
                    return title
    except Exception as e:
        print(f"Error reading walkthrough {walkthrough_path}: {e}")
    return None

def format_user_input(content):
    """Clean and format user input, removing XML tags if desired."""
    # Find user request
    req_match = re.search(r'<USER_REQUEST>(.*?)</USER_REQUEST>', content, re.DOTALL)
    if req_match:
        request = req_match.group(1).strip()
    else:
        request = content.strip()
    return request

def format_tool_calls(tool_calls):
    """Format tool calls for markdown."""
    if not tool_calls:
        return ""
    md = "\n**🔧 Outils appelés :**\n"
    for tool in tool_calls:
        name = tool.get('name', 'Outil inconnu')
        args = tool.get('args', {})
        # Clean arguments if it is a JSON string inside
        args_str = ""
        if isinstance(args, dict):
            args_str = ", ".join([f"`{k}`: {v}" for k, v in args.items()])
        else:
            args_str = str(args)
        md += f"- `{name}` ({args_str})\n"
    return md

def format_transcript_to_markdown(jsonl_path, conv_id, date_str):
    """Convert raw JSONL transcript to a readable markdown file."""
    if not os.path.exists(jsonl_path):
        return None
    
    md_content = []
    md_content.append(f"# 💬 Historique de Conversation - {date_str}")
    md_content.append(f"**ID de Session :** `{conv_id}`\n")
    md_content.append("--- \n")
    
    try:
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    step = json.loads(line)
                    source = step.get('source')
                    step_type = step.get('type')
                    content = step.get('content', '')
                    thinking = step.get('thinking', '')
                    tool_calls = step.get('tool_calls', [])
                    created_at = step.get('created_at', '')
                    
                    time_lbl = ""
                    if created_at:
                        time_lbl, _ = parse_iso_date(created_at)
                        time_lbl = f" *({time_lbl})*"

                    if step_type == 'USER_INPUT':
                        clean_input = format_user_input(content)
                        md_content.append(f"### 👤 Utilisateur{time_lbl}\n")
                        md_content.append(f"{clean_input}\n")
                        md_content.append("--- \n")
                        
                    elif step_type == 'PLANNER_RESPONSE' or (source == 'MODEL' and (content or thinking or tool_calls)):
                        md_content.append(f"### 🤖 Assistant{time_lbl}\n")
                        
                        if thinking:
                            md_content.append("<details>")
                            md_content.append("<summary>💭 Pensées / Raisonnement (Thinking)</summary>\n")
                            md_content.append(f"{thinking}\n")
                            md_content.append("</details>\n")
                            
                        if content:
                            md_content.append(f"{content}\n")
                            
                        if tool_calls:
                            md_content.append(format_tool_calls(tool_calls))
                            
                        md_content.append("--- \n")
                        
                    elif source == 'SYSTEM' and content:
                        # System messages (e.g. tool results) inside details to avoid clutter
                        md_content.append(f"#### ⚙️ Action Système {step_type}{time_lbl}\n")
                        md_content.append("<details>")
                        md_content.append("<summary>⚙️ Voir les détails de l'action / résultat</summary>\n")
                        md_content.append(f"```\n{content}\n```\n")
                        md_content.append("</details>\n")
                        md_content.append("--- \n")
                        
                except Exception as e:
                    # Skip malformed lines
                    continue
    except Exception as e:
        print(f"Error reading transcript {jsonl_path}: {e}")
        return None
        
    return "\n".join(md_content)

def main():
    print(f"Démarrage de la sauvegarde de l'historique...")
    print(f"Source : {BRAIN_DIR}")
    print(f"Destination : {BACKUP_DIR}")
    
    if not os.path.exists(BRAIN_DIR):
        print(f"Erreur : Le dossier source {BRAIN_DIR} n'existe pas.")
        return
        
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    conversations = []
    
    # Scan all directories in brain folder
    for conv_id in os.listdir(BRAIN_DIR):
        conv_path = os.path.join(BRAIN_DIR, conv_id)
        if not os.path.isdir(conv_path) or conv_id == 'tempmediaStorage':
            continue
            
        walkthrough_path = os.path.join(conv_path, "walkthrough.md")
        metadata_path = os.path.join(conv_path, "walkthrough.md.metadata.json")
        
        # Check transcripts
        transcript_path = os.path.join(conv_path, ".system_generated", "logs", "transcript_full.jsonl")
        if not os.path.exists(transcript_path):
            transcript_path = os.path.join(conv_path, ".system_generated", "logs", "transcript.jsonl")
            
        has_walkthrough = os.path.exists(walkthrough_path)
        has_transcript = os.path.exists(transcript_path)
        
        if not (has_walkthrough or has_transcript):
            continue
            
        # Get timestamp
        updated_at = None
        summary = ""
        
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    updated_at = meta.get('updatedAt')
                    summary = meta.get('summary', '')
            except Exception:
                pass
                
        # If no timestamp, use directory mtime
        if not updated_at:
            mtime = os.path.getmtime(conv_path)
            dt = datetime.fromtimestamp(mtime)
            updated_at = dt.isoformat() + 'Z'
            
        readable_time, date_str = parse_iso_date(updated_at)
        
        # Try to get title
        title = extract_metadata_from_walkthrough(walkthrough_path)
        if not title:
            title = summary if summary else f"Session_{conv_id[:8]}"
            
        slug = slugify(title)
        folder_name = f"{date_str}_{slug}"
        dest_folder = os.path.join(BACKUP_DIR, folder_name)
        
        # Track for README index
        conversations.append({
            'id': conv_id,
            'title': title,
            'date': readable_time,
            'date_str': date_str,
            'folder': folder_name,
            'has_walkthrough': has_walkthrough,
            'has_transcript': has_transcript
        })
        
        # Create destination folder
        os.makedirs(dest_folder, exist_ok=True)
        
        # 1. Copy walkthrough.md
        if has_walkthrough:
            shutil.copy2(walkthrough_path, os.path.join(dest_folder, "walkthrough.md"))
            
        # 2. Format transcript to Markdown
        if has_transcript:
            md_transcript = format_transcript_to_markdown(transcript_path, conv_id, readable_time)
            if md_transcript:
                with open(os.path.join(dest_folder, "chat_history.md"), 'w', encoding='utf-8') as f:
                    f.write(md_transcript)
            # Copy raw jsonl as well
            shutil.copy2(transcript_path, os.path.join(dest_folder, "raw_transcript.jsonl"))
            
        print(f"Sauvegardé : {folder_name}")

    # Sort conversations by date descending
    conversations.sort(key=lambda x: x['date'], reverse=True)
    
    # Write Index README.md
    readme_path = os.path.join(BACKUP_DIR, "README.md")
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("# 📚 Historique de Développement & Walkthroughs\n\n")
        f.write("Ce dossier contient l'historique complet des sessions de développement et les explications (walkthroughs) associées pour préserver la logique de l'application et éviter toute perte de données en cas de changement de machine.\n\n")
        
        f.write("## 🗂️ Liste des Sessions\n\n")
        f.write("| Date & Heure | Titre / Sujet de la Session | Fichiers disponibles |\n")
        f.write("| :--- | :--- | :--- |\n")
        
        for conv in conversations:
            files_links = []
            if conv['has_walkthrough']:
                files_links.append(f"[📖 Walkthrough](./{conv['folder']}/walkthrough.md)")
            if conv['has_transcript']:
                files_links.append(f"[💬 Chat History](./{conv['folder']}/chat_history.md)")
                files_links.append(f"[📄 Raw Logs](./{conv['folder']}/raw_transcript.jsonl)")
                
            files_str = " \\| ".join(files_links)
            f.write(f"| {conv['date']} | **{conv['title']}** | {files_str} |\n")
            
    print(f"\nIndex README généré avec succès dans {readme_path}")
    print(f"Nombre total de sessions sauvegardées : {len(conversations)}")

if __name__ == "__main__":
    main()
