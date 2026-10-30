CREATE TABLE IF NOT EXISTS documents (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 filename VARCHAR(255) NOT NULL,
 file_path VARCHAR(1024) NOT NULL,
 status ENUM('queued','processing','ready','failed','ocr_required') NOT NULL DEFAULT 'queued',
 total_pages INT UNSIGNED NOT NULL DEFAULT 0,
 total_chunks INT UNSIGNED NOT NULL DEFAULT 0,
 embedding_model VARCHAR(100) NOT NULL,
 error_message TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_documents_status(status)
);
CREATE TABLE IF NOT EXISTS document_chunks (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 document_id INT UNSIGNED NOT NULL,
 chunk_index INT UNSIGNED NOT NULL,
 content MEDIUMTEXT NOT NULL,
 page_number INT UNSIGNED NOT NULL,
 section_heading VARCHAR(500) NOT NULL,
 embedding JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_chunks_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
 UNIQUE KEY idx_chunk_order(document_id,chunk_index),
 INDEX idx_chunk_page(document_id,page_number)
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 document_id INT UNSIGNED NOT NULL,
 role ENUM('user','assistant') NOT NULL,
 message TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_chat_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
 INDEX idx_chat_document(document_id,id)
);
