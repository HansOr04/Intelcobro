// src/infrastructure/web/middlewares/FileUploadMiddleware.ts

import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { logger } from '../../../shared/utils/Logger';
import { ValidationException } from '../../../application/exceptions/ValidationException';

/**
 * Configuración de tipos de archivo permitidos
 */
export interface FileTypeConfig {
  extensions: string[];
  mimeTypes: string[];
  maxSize: number;
  description: string;
}

/**
 * Configuraciones predefinidas por tipo de archivo
 */
export const FILE_CONFIGS: Record<string, FileTypeConfig> = {
  resume: {
    extensions: ['.pdf', '.doc', '.docx'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    description: 'CV/Resume (PDF, DOC, DOCX)'
  },
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    maxSize: 2 * 1024 * 1024, // 2MB
    description: 'Imagen (JPG, PNG, GIF, WEBP)'
  },
  audio: {
    extensions: ['.mp3', '.wav', '.ogg', '.webm', '.m4a'],
    mimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/mp4'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'Audio (MP3, WAV, OGG, WEBM, M4A)'
  },
  document: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    description: 'Documento (PDF, DOC, DOCX, TXT, RTF)'
  }
};

/**
 * Metadata del archivo subido
 */
export interface FileMetadata {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  extension: string;
  uploadedAt: Date;
  hash: string;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Middleware para manejo de subida de archivos
 */
export class FileUploadMiddleware {
  private static uploadDir = process.env.UPLOAD_DIR || 'uploads';
  private static tempDir = path.join(FileUploadMiddleware.uploadDir, 'temp');

  /**
   * Inicializa directorios necesarios
   */
  static initializeDirectories(): void {
    const directories = [
      FileUploadMiddleware.uploadDir,
      FileUploadMiddleware.tempDir,
      path.join(FileUploadMiddleware.uploadDir, 'resumes'),
      path.join(FileUploadMiddleware.uploadDir, 'images'),
      path.join(FileUploadMiddleware.uploadDir, 'audio'),
      path.join(FileUploadMiddleware.uploadDir, 'documents')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('Upload directory created', { directory: dir });
      }
    });
  }

  /**
   * Configuración de almacenamiento con naming personalizado
   */
  private static createStorage(subdir: string = 'temp') {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(FileUploadMiddleware.uploadDir, subdir);
        
        // Crear directorio si no existe
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        // Generar nombre único: timestamp + random + extension
        const timestamp = Date.now();
        const random = crypto.randomBytes(6).toString('hex');
        const extension = path.extname(file.originalname).toLowerCase();
        const filename = `${timestamp}_${random}${extension}`;
        
        cb(null, filename);
      }
    });
  }

  /**
   * Filtro de archivos personalizable
   */
  private static createFileFilter(allowedConfig: FileTypeConfig) {
    return (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
      try {
        const extension = path.extname(file.originalname).toLowerCase();
        const mimetype = file.mimetype.toLowerCase();

        // Verificar extensión
        if (!allowedConfig.extensions.includes(extension)) {
          const error = new Error(
            `Extensión no permitida. Permitidas: ${allowedConfig.extensions.join(', ')}`
          );
          return cb(error);
        }

        // Verificar MIME type
        if (!allowedConfig.mimeTypes.includes(mimetype)) {
          const error = new Error(
            `Tipo de archivo no permitido. Permitidos: ${allowedConfig.description}`
          );
          return cb(error);
        }

        // Validaciones adicionales de seguridad
        const securityCheck = FileUploadMiddleware.performSecurityChecks(file);
        if (!securityCheck.isValid) {
          const error = new Error(securityCheck.errors.join(', '));
          return cb(error);
        }

        cb(null, true);

      } catch (error) {
        cb(error instanceof Error ? error : new Error('Error validando archivo'));
      }
    };
  }

  /**
   * Middleware para subida de CV/Resume
   */
  static uploadResume() {
    FileUploadMiddleware.initializeDirectories();
    
    const resumeConfig = FILE_CONFIGS.resume;
    if (!resumeConfig) {
      throw new Error('Resume configuration not found');
    }
    
    const upload = multer({
      storage: FileUploadMiddleware.createStorage('resumes'),
      fileFilter: FileUploadMiddleware.createFileFilter(resumeConfig),
      limits: {
        fileSize: resumeConfig.maxSize,
        files: 1,
        fields: 10
      }
    }).single('resume');

    return FileUploadMiddleware.wrapMulter(upload, 'resume');
  }

  /**
   * Middleware para subida de imágenes
   */
  static uploadImage() {
    FileUploadMiddleware.initializeDirectories();
    
    const imageConfig = FILE_CONFIGS.image;
    if (!imageConfig) {
      throw new Error('Image configuration not found');
    }
    
    const upload = multer({
      storage: FileUploadMiddleware.createStorage('images'),
      fileFilter: FileUploadMiddleware.createFileFilter(imageConfig),
      limits: {
        fileSize: imageConfig.maxSize,
        files: 1,
        fields: 10
      }
    }).single('image');

    return FileUploadMiddleware.wrapMulter(upload, 'image');
  }

  /**
   * Middleware para subida de audio
   */
  static uploadAudio() {
    FileUploadMiddleware.initializeDirectories();
    
    const audioConfig = FILE_CONFIGS.audio;
    if (!audioConfig) {
      throw new Error('Audio configuration not found');
    }
    
    const upload = multer({
      storage: FileUploadMiddleware.createStorage('audio'),
      fileFilter: FileUploadMiddleware.createFileFilter(audioConfig),
      limits: {
        fileSize: audioConfig.maxSize,
        files: 1,
        fields: 10
      }
    }).single('audio');

    return FileUploadMiddleware.wrapMulter(upload, 'audio');
  }

  /**
   * Middleware para subida de múltiples archivos
   */
  static uploadMultiple(
    fieldNames: Array<{ name: string; maxCount: number; type: keyof typeof FILE_CONFIGS }>,
    maxTotalSize: number = 50 * 1024 * 1024 // 50MB total
  ) {
    FileUploadMiddleware.initializeDirectories();

    const fields = fieldNames.map(field => ({
      name: field.name,
      maxCount: field.maxCount
    }));

    const upload = multer({
      storage: FileUploadMiddleware.createStorage('temp'),
      fileFilter: (req, file, cb) => {
        // Encontrar configuración del campo
        const fieldConfig = fieldNames.find(f => f.name === file.fieldname);
        if (!fieldConfig) {
          return cb(new Error(`Campo no permitido: ${file.fieldname}`));
        }

        const config = FILE_CONFIGS[fieldConfig.type];
        if (!config) {
          return cb(new Error(`Configuración no encontrada para tipo: ${fieldConfig.type}`));
        }
        
        const filter = FileUploadMiddleware.createFileFilter(config);
        filter(req, file, cb);
      },
      limits: {
        fileSize: Math.max(...Object.values(FILE_CONFIGS).map(c => c.maxSize)),
        files: fieldNames.reduce((sum, field) => sum + field.maxCount, 0),
        fields: 20
      }
    }).fields(fields);

    return FileUploadMiddleware.wrapMulter(upload, 'multiple', maxTotalSize);
  }

  /**
   * Wrapper para manejar errores de multer
   */
  private static wrapMulter(
    upload: any,
    type: string,
    maxTotalSize?: number
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        upload(req, res, async (error: any) => {
          if (error) {
            logger.warn('File upload error', {
              error: error.message,
              code: error.code,
              path: req.path,
              type
            });

            // Limpiar archivos temporales si hay error
            await FileUploadMiddleware.cleanupTempFiles(req);

            if (error instanceof multer.MulterError) {
              const validationError = FileUploadMiddleware.handleMulterError(error);
              return next(validationError);
            }

            return next(new ValidationException(`Error subiendo archivo: ${error.message}`));
          }

          try {
            // Validar tamaño total si es necesario
            if (maxTotalSize && req.files) {
              const totalSize = FileUploadMiddleware.calculateTotalSize(req.files);
              if (totalSize > maxTotalSize) {
                await FileUploadMiddleware.cleanupTempFiles(req);
                return next(new ValidationException(
                  `Tamaño total de archivos excede el límite (${Math.round(maxTotalSize / 1024 / 1024)}MB)`
                ));
              }
            }

            // Procesar archivos subidos
            await FileUploadMiddleware.processUploadedFiles(req);

            // Agregar metadata al request
            req.fileMetadata = FileUploadMiddleware.extractFileMetadata(req);

            logger.info('Files uploaded successfully', {
              path: req.path,
              type,
              fileCount: Array.isArray(req.files) ? req.files.length : 
                        req.files ? Object.keys(req.files).length : 
                        req.file ? 1 : 0
            });

            next();

          } catch (processingError) {
            await FileUploadMiddleware.cleanupTempFiles(req);
            next(processingError);
          }
        });

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Validaciones de seguridad adicionales
   */
  private static performSecurityChecks(file: Express.Multer.File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verificar nombre de archivo
    const filename = file.originalname;
    
    // Caracteres peligrosos en nombres de archivo
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
    if (dangerousChars.test(filename)) {
      errors.push('Nombre de archivo contiene caracteres no permitidos');
    }

    // Longitud del nombre
    if (filename.length > 255) {
      errors.push('Nombre de archivo demasiado largo');
    }

    // Verificar doble extensión (ej: archivo.pdf.exe)
    const parts = filename.split('.');
    if (parts.length > 2) {
      const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
      const hasExecutable = parts.some(part => 
        suspiciousExtensions.includes('.' + part.toLowerCase())
      );
      
      if (hasExecutable) {
        errors.push('Archivo con extensión ejecutable no permitido');
      }
    }

    // Verificar si es un archivo vacío
    if (file.size === 0) {
      errors.push('El archivo está vacío');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Procesa archivos subidos (validaciones adicionales, virus scan, etc.)
   */
  private static async processUploadedFiles(req: Request): Promise<void> {
    const files = FileUploadMiddleware.getAllFiles(req);
    
    for (const file of files) {
      // Generar hash del archivo para detectar duplicados
      const hash = await FileUploadMiddleware.generateFileHash(file.path);
      (file as any).hash = hash;

      // Validar contenido del archivo (magic bytes)
      const isValidContent = await FileUploadMiddleware.validateFileContent(file);
      if (!isValidContent) {
        throw new ValidationException(`Contenido de archivo inválido: ${file.originalname}`);
      }

      // Renombrar archivo con hash para evitar conflictos
      const newPath = await FileUploadMiddleware.moveFileToFinalLocation(file);
      (file as any).finalPath = newPath;
    }
  }

  /**
   * Valida contenido del archivo usando magic bytes
   */
  private static async validateFileContent(file: Express.Multer.File): Promise<boolean> {
    try {
      // Leer primeros bytes del archivo
      const buffer = Buffer.alloc(32);
      const fd = fs.openSync(file.path, 'r');
      fs.readSync(fd, buffer, 0, 32, 0);
      fs.closeSync(fd);

      // Magic bytes para diferentes tipos de archivo
      const magicBytes: Record<string, Buffer[]> = {
        'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
        'image/jpeg': [
          Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),  // JFIF
          Buffer.from([0xFF, 0xD8, 0xFF, 0xE1])   // EXIF
        ],
        'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])], // PNG
        'audio/mpeg': [Buffer.from([0xFF, 0xFB]), Buffer.from([0x49, 0x44, 0x33])], // MP3
        'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])] // RIFF
      };

      const expectedMagicBytes = magicBytes[file.mimetype];
      if (!expectedMagicBytes) {
        return true; // Si no tenemos magic bytes definidos, permitir
      }

      return expectedMagicBytes.some(magic => buffer.subarray(0, magic.length).equals(magic));

    } catch (error) {
      logger.warn('Error validating file content', {
        filename: file.originalname,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Genera hash SHA-256 del archivo
   */
  private static async generateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Mueve archivo a su ubicación final
   */
  private static async moveFileToFinalLocation(file: Express.Multer.File): Promise<string> {
    const hash = (file as any).hash;
    const extension = path.extname(file.originalname);
    const finalFilename = `${hash}${extension}`;
    
    // Determinar subdirectorio basado en tipo de archivo
    let subdir = 'documents';
    if (file.mimetype.startsWith('image/')) subdir = 'images';
    else if (file.mimetype.startsWith('audio/')) subdir = 'audio';
    else if (file.mimetype === 'application/pdf' || 
             file.mimetype.includes('word')) subdir = 'resumes';

    const finalDir = path.join(FileUploadMiddleware.uploadDir, subdir);
    const finalPath = path.join(finalDir, finalFilename);

    // Crear directorio si no existe
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    // Mover archivo si no existe ya
    if (!fs.existsSync(finalPath)) {
      fs.renameSync(file.path, finalPath);
    } else {
      // Si ya existe, eliminar el temporal (es duplicado)
      fs.unlinkSync(file.path);
    }

    return finalPath;
  }

  /**
   * Obtiene todos los archivos del request
   */
  private static getAllFiles(req: Request): Express.Multer.File[] {
    const files: Express.Multer.File[] = [];
    
    if (req.file) {
      files.push(req.file);
    }
    
    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        Object.values(req.files).forEach(fileArray => {
          if (Array.isArray(fileArray)) {
            files.push(...fileArray);
          }
        });
      }
    }
    
    return files;
  }

  /**
   * Calcula tamaño total de archivos
   */
  private static calculateTotalSize(files: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]): number {
    let totalSize = 0;
    
    if (Array.isArray(files)) {
      totalSize = files.reduce((sum, file) => sum + file.size, 0);
    } else {
      Object.values(files).forEach(fileArray => {
        totalSize += fileArray.reduce((sum, file) => sum + file.size, 0);
      });
    }
    
    return totalSize;
  }

  /**
   * Extrae metadata de archivos subidos
   */
  private static extractFileMetadata(req: Request): FileMetadata[] {
    const files = FileUploadMiddleware.getAllFiles(req);
    
    return files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: (file as any).finalPath || file.path,
      size: file.size,
      mimetype: file.mimetype,
      extension: path.extname(file.originalname).toLowerCase(),
      uploadedAt: new Date(),
      hash: (file as any).hash || '',
      isValid: true,
      validationErrors: []
    }));
  }

  /**
   * Limpia archivos temporales
   */
  private static async cleanupTempFiles(req: Request): Promise<void> {
    const files = FileUploadMiddleware.getAllFiles(req);
    
    for (const file of files) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        logger.warn('Error cleaning up temp file', {
          path: file.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Maneja errores específicos de Multer
   */
  private static handleMulterError(error: multer.MulterError): ValidationException {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return new ValidationException(`Archivo demasiado grande. Máximo: ${Math.round(parseInt(error.message.split(' ').pop() || '0') / 1024 / 1024)}MB`);
      
      case 'LIMIT_FILE_COUNT':
        return new ValidationException('Demasiados archivos');
      
      case 'LIMIT_FIELD_KEY':
        return new ValidationException('Nombre de campo demasiado largo');
      
      case 'LIMIT_FIELD_VALUE':
        return new ValidationException('Valor de campo demasiado largo');
      
      case 'LIMIT_FIELD_COUNT':
        return new ValidationException('Demasiados campos');
      
      case 'LIMIT_UNEXPECTED_FILE':
        return new ValidationException(`Campo de archivo inesperado: ${error.field}`);
      
      default:
        return new ValidationException(`Error de subida: ${error.message}`);
    }
  }

  /**
   * Middleware para limpiar archivos antiguos
   */
  static cleanupOldFiles(maxAgeHours: number = 24) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Solo ejecutar limpieza ocasionalmente para no impactar performance
        if (Math.random() > 0.1) { // 10% de probabilidad
          next();
          return;
        }

        const tempDir = FileUploadMiddleware.tempDir;
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convertir a ms
        const now = Date.now();

        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          let cleanedCount = 0;

          for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
              try {
                fs.unlinkSync(filePath);
                cleanedCount++;
              } catch (unlinkError) {
                // Ignorar errores de archivos que ya no existen
              }
            }
          }

          if (cleanedCount > 0) {
            logger.info('Cleaned up old temp files', { count: cleanedCount });
          }
        }

        next();

      } catch (error) {
        // No fallar la request por errores de limpieza
        logger.warn('Error during file cleanup', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next();
      }
    };
  }

  /**
   * Middleware para verificar espacio en disco
   */
  static checkDiskSpace(minFreeSpaceGB: number = 1) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const stats = fs.statSync(FileUploadMiddleware.uploadDir);
        const free = await FileUploadMiddleware.getFreeDiskSpace();
        const minFreeSpaceBytes = minFreeSpaceGB * 1024 * 1024 * 1024;

        if (free < minFreeSpaceBytes) {
          logger.warn('Low disk space', {
            freeSpaceGB: Math.round(free / 1024 / 1024 / 1024 * 100) / 100,
            minRequiredGB: minFreeSpaceGB
          });

          res.status(507).json({
            success: false,
            error: 'Insufficient Storage',
            message: 'No hay suficiente espacio en disco para subir archivos'
          });
          return;
        }

        next();

      } catch (error) {
        // En caso de error verificando espacio, permitir continuar
        logger.warn('Error checking disk space', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next();
      }
    };
  }

  /**
   * Obtiene espacio libre en disco
   */
  private static async getFreeDiskSpace(): Promise<number> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const isWindows = process.platform === 'win32';
      
      const command = isWindows 
        ? `dir /-c "${FileUploadMiddleware.uploadDir}"`
        : `df -k "${FileUploadMiddleware.uploadDir}"`;

      exec(command, (error: any, stdout: string) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          let freeSpace: number;

          if (isWindows) {
            // Parsear salida de Windows
            const lines = stdout.split('\n');
            const lastLine = lines[lines.length - 2];
            if (!lastLine) {
              throw new Error('Could not parse Windows disk space output');
            }
            const matches = lastLine.match(/(\d+)/g);
            if (!matches || matches.length < 3 || !matches[2]) {
              throw new Error('Could not extract disk space values from Windows output');
            }
            freeSpace = parseInt(matches[2]);
          } else {
            // Parsear salida de Unix/Linux
            const lines = stdout.split('\n');
            const dataLine = lines[1];
            if (!dataLine) {
              throw new Error('Could not parse Unix disk space output');
            }
            const parts = dataLine.split(/\s+/);
            if (parts.length < 4 || !parts[3]) {
              throw new Error('Could not extract disk space values from Unix output');
            }
            freeSpace = parseInt(parts[3]) * 1024; // df muestra en KB
          }

          resolve(freeSpace);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Middleware para antivirus scan (simulado)
   */
  static antivirusScan() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const files = FileUploadMiddleware.getAllFiles(req);
        
        for (const file of files) {
          // Simulación de scan antivirus
          const isSafe = await FileUploadMiddleware.performAntivirusScan(file);
          
          if (!isSafe) {
            await FileUploadMiddleware.cleanupTempFiles(req);
            
            logger.warn('Malicious file detected', {
              filename: file.originalname,
              path: file.path,
              ip: req.ip
            });

            res.status(400).json({
              success: false,
              error: 'Malicious File Detected',
              message: 'El archivo contiene contenido malicioso'
            });
            return;
          }
        }

        next();

      } catch (error) {
        await FileUploadMiddleware.cleanupTempFiles(req);
        next(error);
      }
    };
  }

  /**
   * Simulación de scan antivirus (en producción usar ClamAV o similar)
   */
  private static async performAntivirusScan(file: Express.Multer.File): Promise<boolean> {
    try {
      // Leer primeros bytes para detectar patrones conocidos
      const buffer = Buffer.alloc(1024);
      const fd = fs.openSync(file.path, 'r');
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      // Patrones de malware conocidos (muy básico)
      const maliciousPatterns = [
        Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR'), // EICAR test string
        Buffer.from('MZ'), // DOS executable header (en algunos casos)
      ];

      // Verificar si el contenido coincide con patrones maliciosos
      const hasMaliciousPattern = maliciousPatterns.some(pattern => 
        buffer.indexOf(pattern) !== -1
      );

      return !hasMaliciousPattern;

    } catch (error) {
      logger.warn('Error in antivirus scan', {
        filename: file.originalname,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // En caso de error, ser conservativo y rechazar
      return false;
    }
  }

  /**
   * Middleware para generar thumbnails de imágenes
   */
  static generateThumbnails(sizes: number[] = [150, 300]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const files = FileUploadMiddleware.getAllFiles(req);
        const imageFiles = files.filter(file => file.mimetype.startsWith('image/'));

        for (const file of imageFiles) {
          try {
            await FileUploadMiddleware.createThumbnails(file, sizes);
          } catch (thumbError) {
            // No fallar la request por errores de thumbnail
            logger.warn('Error creating thumbnails', {
              filename: file.originalname,
              error: thumbError instanceof Error ? thumbError.message : 'Unknown error'
            });
          }
        }

        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Crea thumbnails de diferentes tamaños (requiere sharp en producción)
   */
  private static async createThumbnails(file: Express.Multer.File, sizes: number[]): Promise<void> {
    // En un entorno real, usarías sharp o similar
    // const sharp = require('sharp');
    
    for (const size of sizes) {
      const thumbnailPath = file.path.replace(
        path.extname(file.path),
        `_thumb_${size}x${size}${path.extname(file.path)}`
      );

      // Simulación de creación de thumbnail
      // En producción:
      // await sharp(file.path)
      //   .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      //   .toFile(thumbnailPath);

      logger.debug('Thumbnail created (simulated)', {
        original: file.path,
        thumbnail: thumbnailPath,
        size
      });
    }
  }
}

/**
 * Extender Request para incluir metadata de archivos
 */
declare global {
  namespace Express {
    interface Request {
      fileMetadata?: FileMetadata[];
    }
  }
}