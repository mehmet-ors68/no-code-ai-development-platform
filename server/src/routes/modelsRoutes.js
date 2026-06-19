const express = require('express');
const router = express.Router();
const authenticateUser = require('../middleware/authenticateUser'); // adjust path as needed
const { getAllModelsByUserId, createModel, deleteModelById, updateModelById, updateStatusById } = require('../models/modelModel.js');
const { createDefaultModelInfo } = require('../models/modelInfoModel.js');

router.get("/", authenticateUser, async (req, res) => {
  const userId = req.userId;
  const cases = await getAllModelsByUserId(userId);
  res.json(cases);
});


// POST create a new model
router.post('/', authenticateUser, async (req, res) => {
  const { title, description, status } = req.body;
  const userId = req.userId;
  try {
    const createdRow = await createModel(title, description, status, userId);
    await createDefaultModelInfo(createdRow._id);
    
    res.status(201).json(createdRow);
  } catch (err) {
    console.error('Error creating case:', err);
    res.status(500).send('Error creating case');
  }
});


// PUT update an existing case by ID
router.put('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;
  try {
    const updatedCase = await updateModelById(id, title, description);
    if (!updatedCase) {
      return res.status(404).send('Case not found');
    }
    res.status(200).json(updatedCase);
  } catch (err) {
    res.status(500).send('Error updating case');
  }
});

// DELETE a case by ID
router.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const deletedModel = await deleteModelById(id);
    if (!deletedModel) {
      return res.status(404).send('Model not found');
    }
    res.status(200).send(`Model with id ${id} deleted`);
  } catch (err) {
    res.status(500).send('Error deleting case');
  }
});

  
// POST create a new model
router.post('/update-status/:id', authenticateUser, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    console.log("status is: ", status)
    console.log("mi is: ", id)
    await updateStatusById(id, status)
    
    res.status(200).send(`status updated!`);
  } catch (err) {
    console.error('Error updating status!', err);
    res.status(500).send('Error updating status!');
  }
});

  module.exports = router;
